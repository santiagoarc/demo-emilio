import Anthropic from "@anthropic-ai/sdk";

/**
 * Per-penguin reports chat. The browser sends the conversation and the demo's
 * simulated data (the demo generates it client-side); this route only builds the
 * Claude call and streams the text back as it arrives.
 *
 * The key comes from ANTHROPIC_API_KEY in .env.local, which is not committed.
 */

const MODEL = "claude-opus-5-5";
const MAX_TURNS = 40;
const MAX_TEXT = 200_000; // characters per message; one penguin's data is around 10–20k

const INSTRUCTIONS = `You are the reports assistant for the penguin care team at SeaWorld Abu Dhabi.
Always answer in English, in the tone of a colleague on the care team: clear, concrete and without filler.

What you do:
- Give detailed reports on a penguin from its data: current location, time in water and on land, time without movement, activity hours, the zones it frequents and how it moves between them, its "How is it doing?" indicator, its health follow-up cases, team notes and incidents.
- Compare against its species average when that helps show whether something is normal or not, and say so with numbers.
- If asked to compare birds, or about the colony, use the colony roster.

Rules:
- Only use the data provided in the conversation. If something is not in the data, say so; don't make it up or present an assumption as fact.
- Clearly separate what the data shows (observed: readings, hours, zones, notes) from what you infer from it. Label inferences as such (e.g. "this may suggest…") and keep them modest.
- Never diagnose disease, injuries, fights, egg-laying or heart issues, and don't present anything as a veterinary diagnosis. If a question needs that, say the tracking data can't answer it and name the data that would be needed instead (e.g. a keeper or vet exam, weight records, behavioral observation, nest checks, clinical tests).
- Reports are about the penguin, not the tracking equipment: never report device failures, battery or connectivity, and never suggest them as the cause of anything.
- "No movement recorded" means repeated readings at the same position; it does not imply the penguin is motionless between readings.
- If the question doesn't make clear which penguin it's about and there is none in context, ask which one (a code like KNG-005 or its name).
- Format: short headings and bullet points or Markdown tables when the report is long; hours with one decimal (e.g. 3.5 h); dates and times as they appear in the data.`;

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
  // The API requires the conversation to start with the user and end with their question.
  while (clean.length && clean[0].role !== "user") clean.shift();
  if (!clean.length || clean[clean.length - 1].role !== "user") return null;
  return { colony, messages: clean };
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is missing from .env.local. Add it and restart the server." }, { status: 503 });
  }
  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) return Response.json({ error: "Invalid request." }, { status: 400 });

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    // If a safety classifier declines the question, the server retries it with the recommended model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: INSTRUCTIONS },
      { type: "text", text: `Colony roster (status as of the latest readings):\n${parsed.colony}`, cache_control: { type: "ephemeral" } },
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
          controller.enqueue(encoder.encode("\n\n_I couldn't answer that question. Try phrasing it another way._"));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n_The answer was cut off for length. Ask for a more specific part._"));
        }
      } catch (error) {
        const msg =
          error instanceof Anthropic.AuthenticationError
            ? "The API key is not valid."
            : error instanceof Anthropic.RateLimitError
              ? "The API usage limit was reached; try again in a moment."
              : error instanceof Anthropic.APIError
                ? `API error (${error.status ?? "no code"}).`
                : "Could not connect to Claude.";
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
