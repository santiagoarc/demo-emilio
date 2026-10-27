"use client";

/**
 * Gráficas propias en SVG/HTML. Reciben datos ya agregados; no calculan nada
 * por su cuenta, así siempre reflejan los filtros activos.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/primitives";

/* ───────────── Tooltip flotante compartido ─────────────
 * Un solo cuadro para todas las gráficas: sigue al cursor, se coloca a un lado
 * (nunca encima de lo que se señala), cambia de lado cerca de los bordes y no
 * recibe el mouse, así no tapa ni bloquea otras tarjetas.
 */
export interface Tip {
  title: ReactNode;
  rows?: { color?: string; label: ReactNode; value: ReactNode }[];
  note?: ReactNode;
}

type TipState = { tip: Tip; x: number; y: number } | null;
let setTipState: ((s: TipState) => void) | null = null;

export function showTip(e: { clientX: number; clientY: number }, tip: Tip) {
  setTipState?.({ tip, x: e.clientX, y: e.clientY });
}
export function hideTip() {
  setTipState?.(null);
}

/** Se monta una vez en la app (AppShell). */
export function ChartTipLayer() {
  const [state, setState] = useState<TipState>(null);
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  useEffect(() => {
    setTipState = setState;
    const hide = () => setState(null);
    window.addEventListener("scroll", hide, true);
    return () => {
      setTipState = null;
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (!state || !box.current) return;
    const { width, height } = box.current.getBoundingClientRect();
    const gap = 16;
    // A la derecha del cursor; si no cabe, a la izquierda. Verticalmente centrado y dentro de la pantalla.
    const left = state.x + gap + width <= window.innerWidth - 8 ? state.x + gap : Math.max(8, state.x - gap - width);
    const top = Math.min(window.innerHeight - height - 8, Math.max(8, state.y - height / 2));
    setPos({ left, top });
  }, [state]);

  if (!state) return null;
  const { tip } = state;
  return (
    <div
      ref={box}
      role="tooltip"
      className="pointer-events-none fixed z-[100] min-w-[150px] max-w-[280px] rounded-xl border border-line-strong bg-panel-solid/95 px-3 py-2 text-[11px] shadow-[0_8px_24px_rgba(11,36,64,0.18)] backdrop-blur"
      style={pos}
    >
      <p className="font-medium text-ink">{tip.title}</p>
      {tip.rows?.map((r, i) => (
        <p key={i} className="mt-1 flex items-center justify-between gap-3 text-muted">
          <span className="inline-flex items-center gap-1.5">
            {r.color && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="num text-ink">{r.value}</span>
        </p>
      ))}
      {tip.note && <p className="mt-1.5 text-[10px] text-faint">{tip.note}</p>}
    </div>
  );
}

export const SERIES = {
  water: "#4fb3ff",
  land: "#9fb4c7",
  stationary: "#8aa0b6",
};

export function Legend({ items, className }: { items: { color: string; label: string; dashed?: boolean }[]; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted", className)}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-[3px]"
            style={i.dashed ? { border: `1px dashed ${i.color}` } : { background: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Barras horizontales con etiqueta. */
export function BarList({ items, format = (v) => String(v), max, onSelect, selected }: {
  items: { key: string; label: ReactNode; value: number; color?: string; hint?: ReactNode }[];
  format?: (v: number) => string;
  max?: number;
  onSelect?: (key: string) => void;
  selected?: string[];
}) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => {
        const on = selected?.includes(i.key);
        return (
          <li key={i.key}>
            <button
              disabled={!onSelect}
              onClick={() => onSelect?.(i.key)}
              onMouseMove={(e) => showTip(e, { title: i.label, rows: [{ color: i.color ?? "var(--accent)", label: "Valor", value: format(i.value) }], note: i.hint })}
              onMouseLeave={hideTip}
              className={cx("group w-full text-left", onSelect && "cursor-pointer")}
            >
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className={cx("truncate", on ? "text-ink" : "text-muted group-hover:text-ink")}>{i.label}</span>
                <span className="num font-semibold text-ink">
                  {format(i.value)}
                  {i.hint && <span className="ml-1 font-normal text-faint">{i.hint}</span>}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${(i.value / m) * 100}%`, background: i.color ?? "var(--accent)", opacity: selected?.length && !on ? 0.35 : 1 }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Barra apilada al 100%. */
export function SplitBar({ parts, height = 10, className, title = "Distribución" }: { parts: { value: number; color: string; label: string }[]; height?: number; className?: string; title?: ReactNode }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const tip: Tip = { title, rows: parts.map((p) => ({ color: p.color, label: p.label, value: total ? `${Math.round((p.value / total) * 100)}%` : "—" })) };
  return (
    <div
      className={cx("flex w-full overflow-hidden rounded-full bg-ink/[0.05]", className)}
      style={{ height }}
      onMouseMove={(e) => showTip(e, tip)}
      onMouseLeave={hideTip}
    >
      {total > 0 &&
        parts.map((p) =>
          p.value > 0 ? (
            <div
              key={p.label}
              className="h-full transition-[width] duration-500"
              style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
            />
          ) : null,
        )}
    </div>
  );
}

export function Donut({ parts, size = 132, thickness = 14, center }: { parts: { value: number; color: string; label: string }[]; size?: number; thickness?: number; center?: ReactNode }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(11,36,64,0.05)" strokeWidth={thickness} />
        {total > 0 &&
          parts.map((p) => {
            const len = (p.value / total) * c;
            const el = (
              <circle
                key={p.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
                strokeDashoffset={-acc}
                strokeLinecap="butt"
                className="transition-all duration-500"
                onMouseMove={(e) => showTip(e, { title: p.label, rows: parts.map((x) => ({ color: x.color, label: x.label, value: `${Math.round((x.value / total) * 100)}%` })) })}
                onMouseLeave={hideTip}
              />
            );
            acc += len;
            return el;
          })}
      </svg>
      {center && <div className="absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

/** Columnas apiladas con tooltip, p. ej. actividad por hora. */
export function StackedColumns({ data, series, height = 180, labelEvery = 1, format = (v) => String(v), highlight }: {
  data: { label: string; values: Record<string, number>; tooltip?: string }[];
  series: { key: string; color: string; label: string }[];
  height?: number;
  labelEvery?: number;
  format?: (v: number) => string;
  highlight?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => series.reduce((a, s) => a + (d.values[s.key] ?? 0), 0)));
  const h = hover ?? null;
  const tipFor = (d: (typeof data)[number]): Tip => ({
    title: d.tooltip ?? d.label,
    rows: series.map((s) => ({ color: s.color, label: s.label, value: format(d.values[s.key] ?? 0) })),
  });
  return (
    <div className="relative">
      <div
        className="flex items-end gap-[3px]"
        style={{ height }}
        onMouseLeave={() => {
          setHover(null);
          hideTip();
        }}
      >
        {data.map((d, i) => {
          const total = series.reduce((a, s) => a + (d.values[s.key] ?? 0), 0);
          return (
            <div
              key={i}
              className="relative flex h-full flex-1 cursor-default flex-col justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseMove={(e) => showTip(e, tipFor(d))}
            >
              <div
                className={cx("flex w-full flex-col-reverse overflow-hidden rounded-t-[4px] transition-opacity", h !== null && h !== i && "opacity-45")}
                style={{ height: `${(total / max) * 100}%`, outline: highlight === i ? "1px solid var(--accent)" : undefined }}
              >
                {series.map((s) => (
                  <div key={s.key} style={{ height: total ? `${((d.values[s.key] ?? 0) / total) * 100}%` : 0, background: s.color }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-faint">
            {i % labelEvery === 0 ? d.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Líneas con área suave, eje Y propio y tooltip por punto. */
export function LineChart({ data, series, height = 200, format = (v) => String(v), yMax }: {
  data: { label: string; values: Record<string, number | null> }[];
  series: { key: string; color: string; label: string; area?: boolean; dashed?: boolean }[];
  height?: number;
  format?: (v: number) => string;
  yMax?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, padL = 36, padR = 8, padT = 10, padB = 22;
  const vals = data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0));
  const max = yMax ?? Math.max(1, ...vals) * 1.12;
  const x = (i: number) => padL + (data.length <= 1 ? (W - padL - padR) / 2 : (i / (data.length - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        onMouseLeave={() => {
          setHover(null);
          hideTip();
        }}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`lc-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="rgba(11,36,64,0.064)" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--faint)">
              {format(t)}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const pts = data.map((d, i) => (d.values[s.key] == null ? null : ([x(i), y(d.values[s.key]!)] as const)));
          const segs: (readonly [number, number])[][] = [];
          let cur: (readonly [number, number])[] = [];
          for (const p of pts) {
            if (p) cur.push(p);
            else if (cur.length) {
              segs.push(cur);
              cur = [];
            }
          }
          if (cur.length) segs.push(cur);
          return (
            <g key={s.key}>
              {segs.map((seg, k) => {
                const d = seg.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
                return (
                  <g key={k}>
                    {s.area && seg.length > 1 && <path d={`${d} L${seg[seg.length - 1][0]},${y(0)} L${seg[0][0]},${y(0)} Z`} fill={`url(#lc-${s.key})`} />}
                    <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "4 4" : undefined} vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}
            </g>
          );
        })}
        {data.map((d, i) => (
          <g key={i}>
            <rect x={x(i) - (W - padL - padR) / Math.max(1, data.length) / 2} y={padT} width={(W - padL - padR) / Math.max(1, data.length)} height={H - padT - padB} fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseMove={(e) =>
                showTip(e, {
                  title: d.label,
                  rows: series.map((s) => ({ color: s.color, label: s.label, value: d.values[s.key] == null ? "sin datos" : format(d.values[s.key]!) })),
                })
              }
            />
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--faint)">
                {d.label}
              </text>
            )}
          </g>
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="rgba(11,36,64,0.25)" />
            {series.map((s) =>
              data[hover].values[s.key] == null ? null : <circle key={s.key} cx={x(hover)} cy={y(data[hover].values[s.key]!)} r="3.5" fill={s.color} stroke="var(--bg)" strokeWidth="1.5" />,
            )}
          </g>
        )}
      </svg>
    </div>
  );
}

/** Matriz origen → destino. */
export function Matrix({ rows, cols, value, format = (v) => String(v), rowLabel, colLabel, colShort }: {
  rows: string[];
  cols: string[];
  value: (r: string, c: string) => number;
  format?: (v: number) => string;
  rowLabel: (k: string) => ReactNode;
  colLabel: (k: string) => string;
  /** Etiqueta corta de columna: la tabla ocupa el ancho disponible y el nombre completo queda en el título. */
  colShort?: (k: string) => string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => cols.map((c) => value(r, c))));
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className={cx("border-separate border-spacing-[3px] text-[11px]", colShort && "w-full table-fixed")}>
        {colShort && (
          <colgroup>
            <col className="w-[148px]" />
          </colgroup>
        )}
        <thead>
          <tr>
            <th className="text-left text-[10px] font-normal text-faint">desde ↓ / hacia →</th>
            {cols.map((c) =>
              colShort ? (
                <th key={c} onMouseMove={(e) => showTip(e, { title: colLabel(c) })} onMouseLeave={hideTip} className="pb-1 text-center align-bottom text-[10px] font-medium text-muted">
                  {colShort(c)}
                </th>
              ) : (
                <th key={c} className="h-36 w-9 align-bottom font-normal text-muted">
                  <div className="mx-auto w-4 [writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-left">{colLabel(c)}</div>
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <td className={cx("whitespace-nowrap pr-2 text-muted", colShort && "truncate")}>
                {rowLabel(r)}
                {colShort && <span className="ml-1 text-[10px] text-faint">{colShort(r)}</span>}
              </td>
              {cols.map((c) => {
                const v = value(r, c);
                return (
                  <td
                    key={c}
                    onMouseMove={(e) =>
                      showTip(e, { title: <>{rowLabel(r)} → {colLabel(c)}</>, rows: [{ color: "rgba(47,216,200,0.8)", label: "Movimientos", value: r === c ? "—" : format(v) }] })
                    }
                    onMouseLeave={hideTip}
                    className={cx("num h-8 rounded-md text-center text-[10px]", !colShort && "w-9")}
                    style={{
                      background: r === c ? "rgba(11,36,64,0.02)" : v ? `rgba(47,216,200,${0.08 + (v / max) * 0.72})` : "rgba(11,36,64,0.03)",
                      color: v / max > 0.5 ? "#032a2a" : "var(--muted)",
                    }}
                  >
                    {r === c ? "·" : v || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Mapa de calor día × hora. */
export function Heatmap({ rows, cols, value, color = "47,216,200", format = (v) => String(v), rowLabel, colLabel }: {
  rows: number[];
  cols: number[];
  value: (r: number, c: number) => number | null;
  color?: string;
  format?: (v: number) => string;
  rowLabel: (r: number) => string;
  colLabel: (c: number) => string;
}) {
  const vals = rows.flatMap((r) => cols.map((c) => value(r, c) ?? 0));
  const max = Math.max(1e-9, ...vals);
  return (
    <div className="scroll-thin overflow-x-auto">
      <div className="grid min-w-[560px] gap-[3px]" style={{ gridTemplateColumns: `64px repeat(${cols.length}, minmax(0,1fr))` }}>
        <div />
        {cols.map((c) => (
          <div key={c} className="text-center text-[9px] text-faint">
            {c % 3 === 0 ? colLabel(c) : ""}
          </div>
        ))}
        {rows.map((r) => (
          <div key={r} className="contents">
            <div className="truncate pr-1 text-[10px] leading-5 text-muted">{rowLabel(r)}</div>
            {cols.map((c) => {
              const v = value(r, c);
              return (
                <div
                  key={c}
                  onMouseMove={(e) => showTip(e, { title: `${rowLabel(r)} · ${colLabel(c)}`, rows: [{ color: `rgb(${color})`, label: "Valor", value: v == null ? "sin datos" : format(v) }] })}
                  onMouseLeave={hideTip}
                  className="h-5 rounded-[4px]"
                  style={{
                    background: v == null ? "repeating-linear-gradient(45deg, rgba(11,36,64,0.04) 0 3px, transparent 3px 6px)" : `rgba(${color},${0.06 + (v / max) * 0.85})`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
