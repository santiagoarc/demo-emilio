"use client";

import { FOOTPRINT, LEVELS, type AviaryTree, type LocationKind } from "@/domain/aviaryTracking";
import { cx } from "@/components/ui/primitives";

export interface SideBird {
  id: string;
  heightM: number;
  precisionM: number;
  /** Horizontal offset from the trunk in metres (east–west projection). */
  dx: number;
  color: string;
  kind: LocationKind;
}

const W = 300;
const H = 250;
const PAD_T = 10;
const PAD_B = 18;
const MAX_H = FOOTPRINT.domeHeight;

/**
 * Side elevation of a tree with the provisional height levels and the birds
 * whose latest position falls in it. Trunk, branch tiers and crown are
 * schematic; birds sit at their estimated height with the uncertainty as a bar.
 */
export function TreeSideView({ tree, birds, selectedBirdId, onSelectBird }: {
  tree: AviaryTree;
  birds: SideBird[];
  selectedBirdId: string | null;
  onSelectBird: (id: string) => void;
}) {
  const y = (m: number) => PAD_T + (1 - Math.min(m, MAX_H) / MAX_H) * (H - PAD_T - PAD_B);
  const cx0 = 118;
  const r = tree.crownRadiusM;
  const sx = Math.min(16, 92 / r); // px per metre horizontally
  const top = y(tree.heightM);
  const tiers = tree.form === "palm" ? [tree.heightM - 0.5] : tree.branchTiersM;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Side view of tree ${tree.id}, ${tree.heightM.toFixed(1)} metres, with ${birds.length} birds located in it`}>
        {LEVELS.filter((l) => l.id !== "ground").map((l) => {
          const lo = y(l.min);
          const hi = y(Math.min(l.max, MAX_H));
          return (
            <g key={l.id}>
              <rect x={0} y={hi} width={W} height={lo - hi} fill={l.color} opacity={0.07} />
              <line x1={0} x2={W} y1={lo} y2={lo} stroke="var(--line-strong)" strokeDasharray="3 3" />
              <text x={W - 4} y={lo - 4} textAnchor="end" className="fill-[var(--faint)] text-[9px]">
                {l.min === 0.5 ? 0 : l.min} m · {l.short}
              </text>
            </g>
          );
        })}
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#8f7f62" strokeWidth={2} />
        <text x={W - 4} y={H - 4} textAnchor="end" className="fill-[var(--faint)] text-[9px]">0 m · Ground</text>

        {/* Crown */}
        {tree.form === "palm" ? (
          <ellipse cx={cx0} cy={top + 6} rx={r * sx} ry={10} fill="#4f9a55" opacity={0.35} />
        ) : (
          tiers.slice(-3).map((h, k, arr) => (
            <ellipse key={h} cx={cx0} cy={y(h) - 6} rx={r * sx * (k === arr.length - 1 ? 1 : 0.75)} ry={k === arr.length - 1 ? Math.max(14, (y(arr[k - 1] ?? h) - top) * 0.7) : 14} fill="#4f9a55" opacity={0.22} />
          ))
        )}
        {/* Trunk */}
        <path d={`M ${cx0 - 5} ${y(0)} L ${cx0 - 2.2} ${top + 4} L ${cx0 + 2.2} ${top + 4} L ${cx0 + 5} ${y(0)} Z`} fill="#7a5b3d" />
        {/* Branch tiers (schematic) */}
        {tree.form !== "palm" &&
          tiers.map((h, k) => {
            const len = r * sx * (0.55 + 0.1 * (k % 2));
            return (
              <g key={h} stroke="#7a5b3d" strokeWidth={2} strokeLinecap="round">
                <line x1={cx0} y1={y(h)} x2={cx0 - len} y2={y(h) - 12} />
                <line x1={cx0} y1={y(h) + 3} x2={cx0 + len * 0.9} y2={y(h) - 9} />
              </g>
            );
          })}
        <line x1={cx0 + r * sx + 10} x2={cx0 + r * sx + 10} y1={y(0)} y2={top} stroke="var(--muted)" />
        <text x={cx0 + r * sx + 14} y={top + 4} className="fill-[var(--ink)] text-[10px] font-semibold">{tree.heightM.toFixed(1)} m</text>

        {/* Birds at estimated height, with uncertainty */}
        {birds.map((b) => {
          const bx = cx0 + Math.max(-r, Math.min(r, b.dx)) * sx;
          const by = y(b.heightM);
          const on = b.id === selectedBirdId;
          return (
            <g key={b.id} className="cursor-pointer" onClick={() => onSelectBird(b.id)}>
              <title>{`${b.id} · ${b.heightM.toFixed(1)} m ± ${b.precisionM} m`}</title>
              <line x1={bx} x2={bx} y1={y(b.heightM + b.precisionM)} y2={y(Math.max(0, b.heightM - b.precisionM))} stroke={b.color} strokeWidth={on ? 3 : 2} opacity={0.45} />
              <circle cx={bx} cy={by} r={on ? 6.5 : 4.5} fill={b.color} stroke="#fff" strokeWidth={1.5} />
              {on && (
                <text x={bx + 9} y={by + 3} className="fill-[var(--ink)] text-[10px] font-semibold">
                  {b.id} · {b.heightM.toFixed(1)} m
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className={cx("mt-1 text-[10px] leading-snug text-faint")}>
        Schematic: trunk, branch tiers and crown are not surveyed. Birds are drawn at their estimated height (bar = ± uncertainty); no specific branch is assigned.
      </figcaption>
    </figure>
  );
}
