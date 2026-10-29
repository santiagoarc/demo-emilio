/**
 * Layout of the demo aviary, drawn after the reference render of The
 * Rainforest used for the presentation: a glass geodesic dome, one great
 * central tree with platforms, elevated boardwalks, lagoons, waterfalls and
 * rock formations. It is an illustrative reconstruction, not a survey: none
 * of these positions or sizes are SeaWorld's.
 *
 * Plan coordinates in metres: x east, z south (the near side of the render),
 * heights in metres above ground. The 3D view and the top view draw this same
 * layout, so every feature and tree sits in the same place in both.
 */

export type XZ = [number, number];

export interface WaterBody {
  id: string;
  name: string;
  /** Closed outline, drawn smoothed. */
  outline: XZ[];
}

export const WATER: WaterBody[] = [
  { id: "west-pool", name: "West pool", outline: [[-34, -6], [-27, -12], [-16, -11], [-10, -3], [-12, 6], [-20, 10], [-30, 8], [-36, 2]] },
  { id: "south-lagoon", name: "South lagoon", outline: [[-44, 16], [-31, 12], [-17, 16], [-5, 20], [9, 18], [20, 22], [18, 30], [4, 32], [-12, 30], [-27, 30], [-40, 26]] },
  { id: "east-pool", name: "East pool", outline: [[16, 6], [26, 2], [36, 5], [38, 13], [28, 18], [18, 14]] },
  { id: "falls-pool", name: "Waterfall pool", outline: [[14, -19], [23, -23], [33, -21], [35, -13], [25, -10], [16, -12]] },
  { id: "north-stream", name: "North stream", outline: [[-14, -24], [-4, -27], [6, -25], [4, -21], [-6, -21], [-14, -20]] },
];

export interface Waterfall {
  x: number;
  z: number;
  /** Drop height, metres. */
  h: number;
  /** Direction the water falls towards, radians in plan (0 = east, π/2 = south). */
  facing: number;
  width: number;
}

export const WATERFALLS: Waterfall[] = [
  { x: -21, z: -12.5, h: 9, facing: Math.PI / 2, width: 2.6 },
  { x: 24, z: -24, h: 11, facing: Math.PI / 2, width: 3 },
  { x: 30, z: -22.5, h: 8, facing: Math.PI / 2, width: 2.4 },
  { x: 35.5, z: -18, h: 6, facing: Math.PI * 0.85, width: 2 },
  { x: 37.5, z: 7, h: 7, facing: Math.PI, width: 2.4 },
  { x: -2, z: 20.5, h: 2.5, facing: Math.PI / 2, width: 1.6 },
];

/** Rock formations: centre and radius; drawn as piles of boulders. */
export const ROCKS: { x: number; z: number; r: number; h: number }[] = [
  { x: -21, z: -15.5, r: 5, h: 10 },
  { x: 24, z: -27, r: 6, h: 12 },
  { x: 31, z: -25.5, r: 5, h: 9 },
  { x: 38, z: -19, r: 4, h: 7 },
  { x: 41, z: 7, r: 4.5, h: 8 },
  { x: -2, z: 18, r: 3, h: 3 },
  { x: -36, z: 18, r: 2.5, h: 2 },
  { x: 12, z: 26, r: 2.5, h: 2 },
];

export interface Walkway {
  id: string;
  /** Centre line; drawn smoothed. */
  path: XZ[];
  /** Deck height, metres (0 = ground path). */
  y: number;
  width: number;
}

export const WALKWAYS: Walkway[] = [
  { id: "canopy-walk", path: [[-50, -10], [-40, -21], [-25, -29], [-8, -31], [10, -31], [26, -31], [40, -25], [48, -13], [50, 0]], y: 6, width: 3.4 },
  { id: "s-walk", path: [[-54, 8], [-42, 7], [-32, 13], [-20, 17], [-8, 14], [2, 13], [11, 12], [21, 18], [33, 22], [45, 20], [54, 13]], y: 4.5, width: 3.4 },
  { id: "east-link", path: [[50, 0], [53, 7], [54, 13]], y: 5, width: 3.2 },
  { id: "south-path", path: [[-56, 14], [-46, 24], [-32, 33]], y: 0.1, width: 3 },
  { id: "southeast-path", path: [[30, 34], [44, 27], [54, 16]], y: 0.1, width: 3 },
];

/** The great central tree and the ring platforms around its trunk. */
export const GREAT_TREE = { x: 0, z: 0, heightM: 30, crownRadiusM: 15 };
export const PLATFORMS: { r: number; y: number }[] = [
  { r: 6.5, y: 6 },
  { r: 5, y: 11 },
];

/** Glass visitor pavilions at the edge of the dome. */
export const PAVILIONS: { x: number; z: number; w: number; d: number; h: number; rot: number }[] = [
  { x: -52, z: -6, w: 7, d: 5, h: 5, rot: 0.15 },
  { x: -50, z: 15, w: 6, d: 5, h: 4.5, rot: -0.3 },
  { x: 53, z: 20, w: 5, d: 6, h: 4.5, rot: 0.4 },
];

/** Prominent trees of the render, placed first; the rest are filled in around them. */
export const FEATURE_TREES: { x: number; z: number; form: "emergent" | "broadleaf" | "palm"; h: number; crown: number }[] = [
  { x: -32, z: -22, form: "emergent", h: 22, crown: 8 },
  { x: 2, z: -18, form: "emergent", h: 21, crown: 7.5 },
  { x: 30, z: -32, form: "broadleaf", h: 16, crown: 6 },
  { x: -42, z: -2, form: "broadleaf", h: 14, crown: 6 },
  { x: -30, z: 32, form: "broadleaf", h: 15, crown: 6 },
  { x: 8, z: 24, form: "palm", h: 12, crown: 3.5 },
  { x: 48, z: 6, form: "broadleaf", h: 14, crown: 6 },
  { x: 40, z: 30, form: "palm", h: 11, crown: 3.4 },
];

/* ---------- geometry helpers ---------- */

export function pointInPolygon(x: number, z: number, poly: XZ[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(x: number, z: number, [ax, az]: XZ, [bx, bz]: XZ) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

function distToPolygonEdge(x: number, z: number, poly: XZ[]) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSegment(x, z, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

/** True when the point is in water, or within `margin` metres of it. */
export function nearWater(x: number, z: number, margin = 0): boolean {
  return WATER.some((w) => pointInPolygon(x, z, w.outline) || (margin > 0 && distToPolygonEdge(x, z, w.outline) < margin));
}

export function distToWalkways(x: number, z: number): number {
  let d = Infinity;
  for (const w of WALKWAYS) for (let i = 0; i + 1 < w.path.length; i++) d = Math.min(d, distToSegment(x, z, w.path[i], w.path[i + 1]) - w.width / 2);
  return d;
}

export function nearRocks(x: number, z: number, margin = 0): boolean {
  return ROCKS.some((r) => Math.hypot(x - r.x, z - r.z) < r.r + margin);
}

export function nearPavilion(x: number, z: number, margin = 0): boolean {
  return PAVILIONS.some((p) => Math.hypot(x - p.x, z - p.z) < Math.max(p.w, p.d) / 2 + margin);
}
