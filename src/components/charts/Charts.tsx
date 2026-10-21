"use client";

/**
 * Gráficas propias en SVG/HTML. Reciben datos ya agregados; no calculan nada
 * por su cuenta, así siempre reflejan los filtros activos.
 */
import { useState, type ReactNode } from "react";
import { cx } from "@/components/ui/primitives";

export const SERIES = {
  water: "#4fb3ff",
  land: "#cfe3f1",
  stationary: "#8aa0b6",
  noFix: "#f5b84b",
  noComm: "#ff6b6b",
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
              className={cx("group w-full text-left", onSelect && "cursor-pointer")}
            >
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className={cx("truncate", on ? "text-ink" : "text-muted group-hover:text-ink")}>{i.label}</span>
                <span className="num font-semibold text-ink">
                  {format(i.value)}
                  {i.hint && <span className="ml-1 font-normal text-faint">{i.hint}</span>}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
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
export function SplitBar({ parts, height = 10, className }: { parts: { value: number; color: string; label: string }[]; height?: number; className?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className={cx("flex w-full overflow-hidden rounded-full bg-white/[0.05]", className)} style={{ height }}>
      {total > 0 &&
        parts.map((p) =>
          p.value > 0 ? (
            <div
              key={p.label}
              title={`${p.label}: ${Math.round((p.value / total) * 100)}%`}
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
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
              >
                <title>{`${p.label}: ${Math.round((p.value / total) * 100)}%`}</title>
              </circle>
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
  const W = 100 / Math.max(1, data.length);
  const h = hover ?? null;
  return (
    <div className="relative">
      <div className="flex items-end gap-[3px]" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => {
          const total = series.reduce((a, s) => a + (d.values[s.key] ?? 0), 0);
          return (
            <div key={i} className="relative flex h-full flex-1 cursor-default flex-col justify-end" onMouseEnter={() => setHover(i)}>
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
      {h !== null && data[h] && (
        <div
          className="pointer-events-none absolute -top-2 z-10 min-w-[150px] -translate-x-1/2 -translate-y-full rounded-xl border border-line-strong bg-panel-solid/95 px-3 py-2 text-[11px] shadow-xl"
          style={{ left: `${(h + 0.5) * W}%` }}
        >
          <p className="mb-1 font-medium text-ink">{data[h].tooltip ?? data[h].label}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-3 text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="num text-ink">{format(data[h].values[s.key] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}
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
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
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
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="rgba(148,197,233,0.08)" />
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
            <rect x={x(i) - (W - padL - padR) / Math.max(1, data.length) / 2} y={padT} width={(W - padL - padR) / Math.max(1, data.length)} height={H - padT - padB} fill="transparent" onMouseEnter={() => setHover(i)} />
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--faint)">
                {d.label}
              </text>
            )}
          </g>
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="rgba(205,231,247,0.25)" />
            {series.map((s) =>
              data[hover].values[s.key] == null ? null : <circle key={s.key} cx={x(hover)} cy={y(data[hover].values[s.key]!)} r="3.5" fill={s.color} stroke="var(--bg)" strokeWidth="1.5" />,
            )}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-[150px] -translate-x-1/2 rounded-xl border border-line-strong bg-panel-solid/95 px-3 py-2 text-[11px] shadow-xl"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <p className="mb-1 font-medium text-ink">{data[hover].label}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-3 text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="num text-ink">{data[hover].values[s.key] == null ? "sin datos" : format(data[hover].values[s.key]!)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Matriz origen → destino. */
export function Matrix({ rows, cols, value, format = (v) => String(v), rowLabel, colLabel }: {
  rows: string[];
  cols: string[];
  value: (r: string, c: string) => number;
  format?: (v: number) => string;
  rowLabel: (k: string) => ReactNode;
  colLabel: (k: string) => string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => cols.map((c) => value(r, c))));
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="border-separate border-spacing-[3px] text-[11px]">
        <thead>
          <tr>
            <th className="text-left text-[10px] font-normal text-faint">desde ↓ / hacia →</th>
            {cols.map((c) => (
              <th key={c} className="h-36 w-9 align-bottom font-normal text-muted">
                <div className="mx-auto w-4 [writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-left">{colLabel(c)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <td className="whitespace-nowrap pr-2 text-muted">{rowLabel(r)}</td>
              {cols.map((c) => {
                const v = value(r, c);
                return (
                  <td
                    key={c}
                    title={`${rowLabel(r)} → ${colLabel(c)}: ${format(v)}`}
                    className="num h-8 w-9 rounded-md text-center text-[10px]"
                    style={{
                      background: r === c ? "rgba(255,255,255,0.02)" : v ? `rgba(47,216,200,${0.08 + (v / max) * 0.72})` : "rgba(255,255,255,0.03)",
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
                  title={`${rowLabel(r)} ${colLabel(c)} · ${v == null ? "sin datos" : format(v)}`}
                  className="h-5 rounded-[4px]"
                  style={{
                    background: v == null ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 3px, transparent 3px 6px)" : `rgba(${color},${0.06 + (v / max) * 0.85})`,
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
