"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cx } from "@/components/ui/primitives";

/** Desplegable compacto de selección múltiple: muestra "Todas" o lo elegido. */
export function FilterMenu<T extends string>({ label, allLabel = "Todos", options, value, onChange, className }: {
  label: string;
  allLabel?: string;
  options: { value: T; label: string; color?: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const summary =
    value.length === 0 ? allLabel : value.length === 1 ? (options.find((o) => o.value === value[0])?.label ?? allLabel) : `${value.length} seleccionadas`;

  return (
    <div ref={ref} className={cx("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx(
          "flex h-10 w-full min-w-[118px] items-center justify-between gap-2 rounded-xl border bg-black/20 px-3 text-left transition hover:border-line-strong",
          value.length ? "border-accent/50" : "border-line",
        )}
      >
        <span className="min-w-0">
          <span className="block text-[10px] leading-tight text-muted">{label}</span>
          <span className="block truncate text-xs font-medium leading-tight text-ink">{summary}</span>
        </span>
        <ChevronDown size={14} className={cx("shrink-0 text-muted transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="scroll-thin absolute right-0 z-30 mt-1 max-h-72 min-w-[220px] overflow-y-auto rounded-xl border border-line-strong bg-panel-solid p-1 shadow-2xl">
          <button
            onClick={() => onChange([])}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-muted hover:bg-white/5 hover:text-ink"
          >
            <span className={cx("grid h-4 w-4 place-items-center rounded border", value.length === 0 ? "border-accent bg-accent/20 text-accent" : "border-line-strong")}>
              {value.length === 0 && <Check size={11} />}
            </span>
            {allLabel}
          </button>
          {options.map((o) => {
            const on = value.includes(o.value);
            return (
              <button
                key={o.value}
                onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-ink hover:bg-white/5"
              >
                <span className={cx("grid h-4 w-4 place-items-center rounded border", on ? "border-accent bg-accent/20 text-accent" : "border-line-strong")}>
                  {on && <Check size={11} />}
                </span>
                {o.color && <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />}
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
