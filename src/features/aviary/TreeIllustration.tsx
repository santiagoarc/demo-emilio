"use client";

import { useMemo, useState } from "react";
import { LEVELS, type AviaryTree, type FixStatus } from "@/domain/aviaryTracking";
import { hashSeed, mulberry32 } from "@/logic/rng";

export interface TreeBird {
  id: string;
  species: string;
  heightM: number;
  /** Uncertainty radius in metres. */
  precisionM: number;
  /** East–west offset from the trunk, metres (side elevation). */
  dx: number;
  status: FixStatus;
  /** Species colour of the dot. */
  ring: string;
}

const W = 380;
const H = 430;
const PAD_L = 62;
const PAD_R = 40;
const PAD_T = 14;
const ROOTS = 30;
const MARK = 6;

/**
 * Side elevation of one tree, roots to crown, with a metre scale and the
 * provisional habitat levels. Each bird is its species image at its estimated
 * height and offset from the trunk: positions are the data, not a layout, so
 * birds close together overlap. Trunk, branches and crown are schematic.
 */
export function TreeIllustration({ tree, birds, highlightId, onHover, onOpen }: {
  tree: AviaryTree;
  birds: TreeBird[];
  highlightId: string | null;
  onHover?: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const top = Math.max(12, Math.ceil((tree.heightM + 2) / 3) * 3);
  const groundY = H - ROOTS;
  const y = (m: number) => PAD_T + (1 - Math.min(m, top) / top) * (groundY - PAD_T);
  const cx = PAD_L + (W - PAD_L - PAD_R) / 2;
  const r = tree.crownRadiusM;
  const sx = Math.min(16, (W - PAD_L - PAD_R) / 2 / (r + 1.2));
  const art = useMemo(() => drawTree(tree, cx, groundY, y, sx), [tree, cx, groundY, sx, top]); // eslint-disable-line react-hooks/exhaustive-deps
  const showAllLabels = birds.length <= 6;
  const ticks = Array.from({ length: Math.floor(top / 3) + 1 }, (_, i) => i * 3);

  // Draw the highlighted bird last so it sits on top.
  const ordered = [...birds].sort((a, b) => (a.id === (hover ?? highlightId) ? 1 : 0) - (b.id === (hover ?? highlightId) ? 1 : 0));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img" aria-label={`Tree ${tree.id}, ${tree.heightM.toFixed(1)} m, with ${birds.length} birds located in it`}>
      <defs>
        <radialGradient id="leafA" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#5fbf6a" />
          <stop offset="1" stopColor="#2f7a3c" />
        </radialGradient>
        <radialGradient id="leafB" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#4aa85a" />
          <stop offset="1" stopColor="#245f30" />
        </radialGradient>
        <linearGradient id="bark" x1="0" x2="1">
          <stop offset="0" stopColor="#5b3f27" />
          <stop offset="0.5" stopColor="#8a6440" />
          <stop offset="1" stopColor="#4c3420" />
        </linearGradient>
      </defs>

      {/* Habitat levels and metre scale */}
      {LEVELS.map((l) => {
        const lo = Math.max(0, l.min);
        const hi = Math.min(top, l.max);
        if (l.id === "ground" || lo >= top) return null;
        return (
          <g key={l.id}>
            <rect x={PAD_L - 4} y={y(hi)} width={W - PAD_L - PAD_R + 8} height={y(lo) - y(hi)} fill={l.color} opacity={0.06} />
            <line x1={4} x2={W - PAD_R} y1={y(lo)} y2={y(lo)} stroke="var(--line-strong)" strokeDasharray="3 4" />
            <text x={6} y={y(hi) + 14} className="fill-[var(--ink)] text-[11px] font-semibold">{l.short}</text>
            <text x={6} y={y(hi) + 27} className="fill-[var(--muted)] text-[10px]">
              {l.min === 0.5 ? 0 : l.min}–{l.max === Infinity ? `${top}+` : l.max} m
            </text>
          </g>
        );
      })}
      <text x={6} y={groundY - 6} className="fill-[var(--ink)] text-[11px] font-semibold">Ground</text>
      <line x1={W - PAD_R + 8} x2={W - PAD_R + 8} y1={y(top)} y2={groundY} stroke="var(--line-strong)" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={W - PAD_R + 5} x2={W - PAD_R + 11} y1={y(t)} y2={y(t)} stroke="var(--muted)" />
          <text x={W - PAD_R + 14} y={y(t) + 3} className="fill-[var(--muted)] text-[9px]">{t} m</text>
        </g>
      ))}

      {/* Ground and roots */}
      <rect x={0} y={groundY} width={W - PAD_R} height={ROOTS} fill="#3b2c1d" opacity={0.55} />
      <line x1={0} x2={W - PAD_R} y1={groundY} y2={groundY} stroke="#8f7f62" strokeWidth={2} />
      {art.roots.map((d, i) => (
        <path key={i} d={d} stroke="#6b4a2c" strokeWidth={i % 2 ? 2.5 : 4} fill="none" strokeLinecap="round" opacity={0.9} />
      ))}

      {/* Trunk, branches, crown */}
      {art.back.map((c, i) => (
        <circle key={`b${i}`} cx={c.x} cy={c.y} r={c.r} fill="url(#leafB)" opacity={0.85} />
      ))}
      <path d={art.trunk} fill="url(#bark)" />
      {art.branches.map((b, i) => (
        <path key={i} d={b.d} stroke="#6f4f31" strokeWidth={b.w} fill="none" strokeLinecap="round" />
      ))}
      {art.front.map((c, i) => (
        <circle key={`f${i}`} cx={c.x} cy={c.y} r={c.r} fill="url(#leafA)" opacity={0.78} />
      ))}
      <line x1={cx + r * sx + 14} x2={cx + r * sx + 14} y1={y(tree.heightM)} y2={groundY} stroke="var(--accent)" strokeDasharray="2 3" opacity={0.7} />
      <text x={cx + r * sx + 10} y={y(tree.heightM) - 5} textAnchor="end" className="fill-[var(--accent)] text-[10px] font-semibold">
        {tree.heightM.toFixed(1)} m
      </text>

      {/* Birds at their estimated position */}
      {ordered.map((b) => {
        const bx = cx + Math.max(-(r + 1), Math.min(r + 1, b.dx)) * sx;
        const by = y(b.heightM);
        const on = b.id === highlightId || b.id === hover;
        const s = on ? 1.3 : 1;
        const label = on || showAllLabels;
        return (
          <g
            key={b.id}
            className="cursor-pointer"
            onMouseEnter={() => (setHover(b.id), onHover?.(b.id))}
            onMouseLeave={() => (setHover(null), onHover?.(null))}
            onClick={() => onOpen(b.id)}
          >
            <title>{`${b.id} · ${b.heightM.toFixed(1)} m ± ${b.precisionM} m`}</title>
            <line x1={bx} x2={bx} y1={y(b.heightM + b.precisionM)} y2={y(Math.max(0, b.heightM - b.precisionM))} stroke={b.ring} strokeWidth={2} opacity={on ? 0.7 : 0.3} />
            <g transform={`translate(${bx} ${by}) scale(${s})`} style={{ transition: "transform 200ms ease" }}>
              {on && <circle r={MARK + 5} fill={b.ring} opacity={0.25} />}
              <circle r={MARK} fill={b.ring} stroke="#fff" strokeWidth={2} />
              <circle r={MARK + 1} fill="none" stroke="rgba(3,16,28,0.55)" strokeWidth={1} />
            </g>
            {label && (
              <g transform={`translate(${bx + MARK * s + 5} ${by - 12})`}>
                <rect width={58} height={25} rx={5} fill="var(--panel-solid)" stroke="var(--line-strong)" opacity={0.95} />
                <text x={6} y={10} className="fill-[var(--ink)] font-mono text-[9px] font-semibold">{b.id}</text>
                <text x={6} y={20} className="fill-[var(--muted)] text-[9px]">{b.heightM.toFixed(1)} m</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

interface Blob {
  x: number;
  y: number;
  r: number;
}

/** Schematic tree geometry, stable for each tree. */
function drawTree(tree: AviaryTree, cx: number, groundY: number, y: (m: number) => number, sx: number) {
  const rng = mulberry32(hashSeed("tree-art", tree.id));
  const h = tree.heightM;
  const r = tree.crownRadiusM * sx;
  const palm = tree.form === "palm";
  const topY = y(h);

  // Roots spread under the ground line.
  const roots: string[] = [];
  const nRoots = palm ? 4 : 7;
  for (let i = 0; i < nRoots; i++) {
    const dir = i % 2 ? 1 : -1;
    const reach = (palm ? 18 : 30) + rng() * (palm ? 14 : 40);
    const depth = 8 + rng() * 18;
    roots.push(`M ${cx + dir * 4} ${groundY - 2} Q ${cx + dir * reach * 0.5} ${groundY + depth * 0.4} ${cx + dir * reach} ${groundY + depth}`);
  }

  // Trunk: tapered with a slight bend.
  const base = palm ? 7 : 11 + h * 0.25;
  const tip = palm ? 4 : 4.5;
  const trunkTop = palm ? topY + 6 : y(h * 0.78);
  const bend = (rng() - 0.5) * (palm ? 14 : 8);
  const midY = (groundY + trunkTop) / 2;
  const trunk = `M ${cx - base} ${groundY + 2}
    C ${cx - base * 0.8} ${midY + 30}, ${cx - tip + bend} ${midY - 20}, ${cx - tip + bend} ${trunkTop}
    L ${cx + tip + bend} ${trunkTop}
    C ${cx + tip + bend} ${midY - 20}, ${cx + base * 0.8} ${midY + 30}, ${cx + base} ${groundY + 2} Z`;

  const branches: { d: string; w: number }[] = [];
  const back: Blob[] = [];
  const front: Blob[] = [];

  if (palm) {
    const tx = cx + bend;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.05 + (i / 8) * 0.9);
      const len = r * (0.9 + rng() * 0.4);
      const ex = tx - Math.cos(a) * len;
      const ey = topY + 10 + Math.sin(a) * len * 0.15 + (Math.abs(Math.cos(a)) * len) * 0.35;
      branches.push({ d: `M ${tx} ${topY + 6} Q ${tx - Math.cos(a) * len * 0.5} ${topY - 14} ${ex} ${ey}`, w: 3 });
      front.push({ x: (tx + ex) / 2, y: (topY + ey) / 2 - 2, r: 5 + rng() * 3 });
    }
    return { roots, trunk, branches, back, front };
  }

  // Branch tiers (simulated reference points) with leaf clusters at their ends.
  tree.branchTiersM.forEach((th, k) => {
    const by = y(th);
    for (const dir of [-1, 1]) {
      const reach = r * (0.55 + 0.35 * (k / Math.max(1, tree.branchTiersM.length - 1))) * (0.85 + rng() * 0.3);
      const ex = cx + bend * (1 - th / h) + dir * reach;
      const ey = by - 14 - rng() * 16;
      branches.push({ d: `M ${cx + bend * 0.5} ${by + 4} Q ${cx + dir * reach * 0.45} ${by - 2} ${ex} ${ey}`, w: Math.max(2, 7 - k * 1.3) });
      back.push({ x: ex, y: ey, r: r * 0.32 + rng() * 6 });
      front.push({ x: ex + dir * 4, y: ey + 6, r: r * 0.22 + rng() * 5 });
    }
  });
  // Crown top.
  const crownY = topY + r * 0.28;
  for (let i = 0; i < 5; i++) {
    const a = (i / 4) * Math.PI;
    back.push({ x: cx + Math.cos(a) * r * 0.55, y: crownY + Math.sin(a) * r * 0.12, r: r * 0.36 + rng() * 6 });
  }
  front.push({ x: cx, y: crownY + 4, r: r * 0.34 });
  return { roots, trunk, branches, back, front };
}
