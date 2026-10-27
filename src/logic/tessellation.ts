/**
 * Splits the plane among the zones so they are drawn edge to edge, with no gaps.
 *
 * Each point of the enclosure belongs to the nearest zone (with a slight
 * wobble so borders look organic). Drawing only: readings still use each
 * zone's original polygon.
 */
import type { HabitatZone } from "@/domain/types";
import { pointInPolygon, type Pt } from "./geometry";

const CELL = 10;

function distToPolygon(x: number, y: number, poly: Pt[]): number {
  if (pointInPolygon(x, y, poly)) return 0;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const ex = ax + t * dx - x;
    const ey = ay + t * dy - y;
    best = Math.min(best, ex * ex + ey * ey);
  }
  return Math.sqrt(best);
}

/** Smooth, deterministic wobble, different for each zone. */
function wobble(x: number, y: number, k: number): number {
  return 22 * Math.sin(x * 0.011 + k * 1.7) * Math.cos(y * 0.014 + k * 0.9) + 9 * Math.sin((x - y) * 0.019 + k * 2.3);
}

/** Walks the outline of the marked cells and returns the outer polygon. */
function traceOutline(mask: Uint8Array, cols: number, rows: number, x0: number, y0: number): Pt[] {
  const at = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows && mask[r * cols + c] === 1;
  // Directed border edges (clockwise), indexed by their start vertex.
  const next = new Map<number, number[]>();
  const key = (c: number, r: number) => r * (cols + 1) + c;
  const add = (a: number, b: number) => {
    const l = next.get(a);
    if (l) l.push(b);
    else next.set(a, [b]);
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!at(c, r)) continue;
      if (!at(c, r - 1)) add(key(c, r), key(c + 1, r));
      if (!at(c + 1, r)) add(key(c + 1, r), key(c + 1, r + 1));
      if (!at(c, r + 1)) add(key(c + 1, r + 1), key(c, r + 1));
      if (!at(c - 1, r)) add(key(c, r + 1), key(c, r));
    }
  }
  // Keep the longest loop (the outer outline).
  let best: number[] = [];
  while (next.size) {
    const start = next.keys().next().value as number;
    const loop: number[] = [];
    let v = start;
    for (;;) {
      const l = next.get(v);
      if (!l) break;
      const w = l.pop()!;
      if (!l.length) next.delete(v);
      loop.push(v);
      v = w;
      if (v === start) break;
    }
    if (loop.length > best.length) best = loop;
  }
  return best.map((k) => [x0 + (k % (cols + 1)) * CELL, y0 + Math.floor(k / (cols + 1)) * CELL]);
}

/**
 * Local smoothing (neighbor averaging, several passes). Because it is local and
 * symmetric, two zones sharing a border get the same curve; points on the
 * outer frame stay put so the enclosure remains filled.
 */
function relax(pts: Pt[], iterations: number, bounds: { x: number; y: number; w: number; h: number }): Pt[] {
  const onFrame = (p: Pt) => p[0] <= bounds.x || p[1] <= bounds.y || p[0] >= bounds.x + bounds.w || p[1] >= bounds.y + bounds.h;
  const fixed = pts.map(onFrame);
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    p = p.map((q, i) => {
      if (fixed[i]) return q;
      const a = p[(i - 1 + p.length) % p.length];
      const b = p[(i + 1) % p.length];
      return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4];
    });
  }
  return p.filter((_, i) => fixed[i] || i % 2 === 0);
}

const cache = new WeakMap<HabitatZone[], Map<string, string>>();

/** SVG path of each zone's region within the given rectangle. */
export function tessellateZones(zones: HabitatZone[], bounds: { x: number; y: number; w: number; h: number }): Map<string, string> {
  const hit = cache.get(zones);
  if (hit) return hit;
  const cols = Math.round(bounds.w / CELL);
  const rows = Math.round(bounds.h / CELL);
  const owner = new Int16Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = bounds.x + (c + 0.5) * CELL;
      const y = bounds.y + (r + 0.5) * CELL;
      let best = 0;
      let bestD = Infinity;
      zones.forEach((z, i) => {
        const d0 = distToPolygon(x, y, z.polygon);
        const d = d0 === 0 ? -1e6 : d0 + wobble(x, y, i);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      owner[r * cols + c] = best;
    }
  }
  const out = new Map<string, string>();
  zones.forEach((z, i) => {
    const mask = new Uint8Array(cols * rows);
    for (let k = 0; k < mask.length; k++) mask[k] = owner[k] === i ? 1 : 0;
    const pts = relax(traceOutline(mask, cols, rows, bounds.x, bounds.y), 24, bounds);
    out.set(z.id, pts.length ? `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z` : "");
  });
  cache.set(zones, out);
  return out;
}
