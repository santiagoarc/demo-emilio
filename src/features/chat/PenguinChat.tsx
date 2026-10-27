"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, MessageSquareText, RotateCcw, Square, X } from "lucide-react";
import { useDemo } from "@/state/DemoProvider";
import { cx } from "@/components/ui/primitives";
import { colonyRoster, mentionedPenguins, penguinDossier } from "./penguinContext";
import { ASK_EVENT } from "./ask";
import { localAnswer } from "./localReports";

/** Lo que se ve en pantalla y lo que se manda a Claude (la pregunta más las fichas adjuntas). */
interface Turn {
  role: "user" | "assistant";
  text: string;
  sent: string;
  attached?: string[];
  /** Pingüinos de los que trata la pregunta, para seguir la conversación sin repetir el código. */
  about?: string[];
}

const SUGGESTIONS = ["Dame el reporte completo de KNG-005", "¿Qué pingüinos pasaron menos tiempo en el agua hoy?", "Compara GEN-001 con el promedio de su especie"];

/**
 * Chat de reportes por pingüino. Responde con la información del sistema; si el
 * servidor tiene llave de Claude, la pregunta va a Claude con las fichas adjuntas
 * (la primera vez que se menciona cada pingüino, o el que está abierto en pantalla).
 */
export function PenguinChat() {
  const demo = useDemo();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // null: aún no se sabe; false: el servidor no tiene llave y se responde con los datos del sistema.
  const [claude, setClaude] = useState<boolean | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns]);

  // La última versión de send, para el aviso de "pedir análisis" de otras pantallas.
  const sendRef = useRef<(q: string) => void>(() => {});
  useEffect(() => {
    const onAsk = (e: Event) => {
      setOpen(true);
      sendRef.current((e as CustomEvent<string>).detail);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);

  // El pingüino que el usuario tiene abierto: su ficha o el seleccionado en el mapa.
  const onScreen = pathname.startsWith("/penguins/") ? decodeURIComponent(pathname.split("/")[2] ?? "") : params.get("penguin");

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const already = new Set(turns.flatMap((t) => t.attached ?? []));
    let found = mentionedPenguins(demo.dataset.penguins, q);
    let note = "";
    if (!found.length && onScreen && !turns.length) {
      const p = demo.penguinById.get(onScreen);
      if (p) {
        found = [p];
        note = `(El usuario tiene abierta la ficha de ${p.id}.)\n`;
      }
    }
    const fresh = found.filter((p) => !already.has(p.id)).slice(0, 4);
    const sent = fresh.length ? `${q}\n\n${note}<datos>\n${fresh.map((p) => penguinDossier(demo, p)).join("\n\n")}\n</datos>` : q;

    const history: Turn[] = [...turns, { role: "user", text: q, sent, attached: fresh.map((p) => p.id), about: found.map((p) => p.id) }];
    setTurns([...history, { role: "assistant", text: "", sent: "" }]);
    setInput("");

    // Respuesta con los datos del sistema: al instante y sin servicios externos.
    const context = turns.flatMap((t) => t.about ?? []).map((id) => demo.penguinById.get(id)!).filter(Boolean);
    const local = () => localAnswer(demo, q, mentionedPenguins(demo.dataset.penguins, q), context.length ? context : found);
    if (claude === false) {
      setTurns([...history, { role: "assistant", text: local(), sent: local() }]);
      return;
    }

    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    let answer = "";
    const show = (text: string) => setTurns((ts) => [...ts.slice(0, -1), { role: "assistant", text, sent: text }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          colony: colonyRoster(demo),
          messages: history.filter((t) => t.sent).map((t) => ({ role: t.role, content: t.sent })),
        }),
      });
      if (res.status === 503) {
        setClaude(false);
        show(local());
        return;
      }
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        show(`_${err?.error ?? `No se pudo obtener respuesta (${res.status}).`}_`);
        return;
      }
      setClaude(true);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        show(answer);
      }
    } catch (e) {
      show(answer + ((e as Error).name === "AbortError" ? "\n\n_Respuesta detenida._" : "\n\n_Se perdió la conexión._"));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  useEffect(() => {
    sendRef.current = (q) => void send(q);
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cx("fixed right-5 z-50 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(11,36,64,0.25)] transition hover:bg-[#0b8178]",
            // En el mapa, abajo a la derecha está el botón de la ficha del panel.
            pathname === "/map" ? "bottom-[84px]" : "bottom-5",
          )}
        >
          <MessageSquareText size={18} /> Reportes
        </button>
      )}
      {open && (
        <section className="fixed bottom-5 right-5 z-50 flex h-[min(680px,calc(100vh-40px))] w-[min(440px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-line-strong bg-panel-solid shadow-[0_16px_48px_rgba(11,36,64,0.25)]">
          <header className="flex items-center gap-2 border-b border-line px-4 py-3">
            <MessageSquareText size={17} className="text-accent" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Reportes por pingüino</h2>
              <p className="text-[11px] text-muted">Pregunta por código o nombre · {claude ? "responde Claude con los datos del sistema" : "con la información del sistema"}</p>
            </div>
            {turns.length > 0 && (
              <button onClick={() => !busy && setTurns([])} title="Nueva conversación" className="rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink">
                <RotateCcw size={15} />
              </button>
            )}
            <button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink">
              <X size={16} />
            </button>
          </header>

          <div ref={scroller} className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {turns.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted">Pide el reporte de un ejemplar, compara contra su especie o pregunta por la colonia.</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => void send(s)} className="block w-full rounded-xl border border-line-strong px-3 py-2 text-left text-xs text-ink hover:bg-ink/[0.04]">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {turns.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="ml-8 rounded-2xl rounded-br-md bg-accent/12 px-3 py-2 text-sm text-ink">
                  {t.text}
                  {!!t.attached?.length && <p className="mt-1 text-[10px] text-muted">Ficha adjunta: {t.attached.join(", ")}</p>}
                </div>
              ) : (
                <div key={i} className="chat-md text-sm text-ink">
                  {t.text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.text}</ReactMarkdown> : <span className="text-xs text-muted">Preparando el reporte…</span>}
                </div>
              ),
            )}
          </div>

          <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Ej. ¿Cómo va Koda esta semana?"
              className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-line-strong bg-panel-solid px-3 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            {busy ? (
              <button type="button" onClick={() => abort.current?.abort()} aria-label="Detener" className="grid h-10 w-10 place-items-center rounded-xl bg-ink/10 text-ink hover:bg-ink/15">
                <Square size={14} />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} aria-label="Enviar" className={cx("grid h-10 w-10 place-items-center rounded-xl bg-accent text-white transition hover:bg-[#0b8178]", !input.trim() && "opacity-40")}>
                <ArrowUp size={16} />
              </button>
            )}
          </form>
        </section>
      )}
    </>
  );
}
