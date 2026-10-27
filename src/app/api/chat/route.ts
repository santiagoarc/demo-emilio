import Anthropic from "@anthropic-ai/sdk";

/**
 * Chat de reportes por pingüino. El navegador manda la conversación y los datos
 * simulados de la demo (la demo los genera allá); aquí solo se arma la llamada a
 * Claude y se regresa el texto conforme llega.
 *
 * La llave sale de ANTHROPIC_API_KEY en .env.local, que no se sube al repo.
 */

const MODEL = "claude-opus-5-5";
const MAX_TURNS = 40;
const MAX_TEXT = 200_000; // caracteres por mensaje; los datos de un pingüino rondan 10–20 mil

const INSTRUCTIONS = `Eres el asistente de reportes del equipo de cuidado de pingüinos de SeaWorld Abu Dhabi (demo "Penguin Tracking & Care").
Respondes en español, con el tono de un colega del equipo de cuidado: claro, concreto y sin relleno.

Qué haces:
- Das reportes detallados de un pingüino a partir de sus datos: ubicación actual, tiempo en agua y en tierra, tiempo sin movimiento, horarios de actividad, zonas que frecuenta y cómo se mueve entre ellas, su "¿cómo va?", sus casos de seguimiento de salud, notas del equipo e incidentes.
- Comparas contra el promedio de su especie cuando ayuda a entender si algo es normal o no, y lo dices con números.
- Si te piden comparar ejemplares, o la colonia, usas la lista de la colonia.

Reglas:
- Solo usas los datos que vienen en la conversación. Si algo no está en los datos, dilo; no lo inventes ni lo supongas como hecho.
- Los datos son simulados (es una demo); no hace falta repetirlo en cada respuesta, pero no presentes nada como diagnóstico veterinario.
- Los reportes son sobre el pingüino, no sobre el equipo de rastreo: no reportes fallas, batería ni conectividad de dispositivos, ni las sugieras como causa de nada.
- "Sin movimiento registrado" significa lecturas repetidas en la misma posición; no implica que el pingüino esté inmóvil fuera de las lecturas.
- Si la pregunta no deja claro de qué pingüino se habla y no hay uno en contexto, pregunta cuál (código como KNG-005 o su nombre).
- Formato: títulos cortos y viñetas o tablas en Markdown cuando el reporte es largo; horas con una decimal (p. ej. 3.5 h); fechas y horas como vienen en los datos.`;

type ChatTurn = { role: "user" | "assistant"; content: string };

function parseBody(body: unknown): { colony: string; messages: ChatTurn[] } | null {
  if (!body || typeof body !== "object") return null;
  const { colony, messages } = body as { colony?: unknown; messages?: unknown };
  if (typeof colony !== "string" || colony.length > MAX_TEXT || !Array.isArray(messages)) return null;
  const turns = messages.slice(-MAX_TURNS);
  const clean: ChatTurn[] = [];
  for (const m of turns) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim() || content.length > MAX_TEXT) return null;
    clean.push({ role, content });
  }
  // La API exige que la conversación empiece con el usuario y termine con su pregunta.
  while (clean.length && clean[0].role !== "user") clean.shift();
  if (!clean.length || clean[clean.length - 1].role !== "user") return null;
  return { colony, messages: clean };
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Falta ANTHROPIC_API_KEY en .env.local. Agrégala y reinicia el servidor." }, { status: 503 });
  }
  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) return Response.json({ error: "Solicitud inválida." }, { status: 400 });

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    // Si un clasificador de seguridad rechaza la pregunta, el servidor la reintenta con el modelo recomendado.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: INSTRUCTIONS },
      { type: "text", text: `Lista de la colonia (estado al corte de lecturas):\n${parsed.colony}`, cache_control: { type: "ephemeral" } },
    ],
    messages: parsed.messages,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n_No pude responder esa pregunta. Intenta formularla de otra manera._"));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n_La respuesta se cortó por largo. Pide una parte más específica._"));
        }
      } catch (error) {
        const msg =
          error instanceof Anthropic.AuthenticationError
            ? "La llave de la API no es válida."
            : error instanceof Anthropic.RateLimitError
              ? "Se alcanzó el límite de uso de la API; intenta en un momento."
              : error instanceof Anthropic.APIError
                ? `Error de la API (${error.status ?? "sin código"}).`
                : "No se pudo conectar con Claude.";
        console.error("[chat]", error);
        controller.enqueue(encoder.encode(`\n\n_${msg}_`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
