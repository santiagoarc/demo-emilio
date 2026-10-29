import type { Vec3 } from "@/domain/aviaryTracking";

/**
 * Projection from the aviary plan (metres) onto the reference render
 * (public/aviary/rainforest-reference.png, 1536 × 1024 px).
 *
 * The render is an oblique, artistic view, not a survey, so the mapping is an
 * approximation: a homography fitted to features visible in both the plan
 * and the picture (boardwalk ends, the great tree, the pools), plus a lift
 * for height that grows with the local ground scale. Good enough to place
 * birds and trees on the picture; not a measurement.
 */

export const REFERENCE_IMAGE = { src: "/aviary/rainforest-reference.png", width: 1536, height: 1024 };

/** Plan point (x, z) ↔ picture pixel (u, v), read off the render. */
const CONTROL: [number, number, number, number][] = [
  [-50, -10, 150, 250], // canopy walkway, west end
  [50, 0, 1400, 420], // canopy walkway, east end
  [-54, 8, 150, 620], // S boardwalk, west end
  [54, 13, 1500, 800], // S boardwalk, east end
  [0, 0, 765, 650], // great tree, base of the trunk
  [-22, -1, 420, 480], // west pool
  [27, 10, 1160, 650], // east pool
  [-10, 25, 620, 820], // south lagoon
  [24, -16, 1110, 360], // waterfall pool
  [-25, -29, 450, 180], // canopy walkway along the back of the dome
  [-8, -31, 700, 172],
  [10, -31, 900, 180],
  [26, -31, 1100, 200],
  [40, -25, 1280, 280],
];

/** Least-squares homography (h33 = 1) from the control points. */
function fitHomography(pts: [number, number, number, number][]): number[] {
  // Normal equations AᵀA h = Aᵀb for the 8 unknowns.
  const ata = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const atb = new Array(8).fill(0);
  const addRow = (row: number[], b: number) => {
    for (let i = 0; i < 8; i++) {
      atb[i] += row[i] * b;
      for (let j = 0; j < 8; j++) ata[i][j] += row[i] * row[j];
    }
  };
  for (const [x, z, u, v] of pts) {
    addRow([x, z, 1, 0, 0, 0, -u * x, -u * z], u);
    addRow([0, 0, 0, x, z, 1, -v * x, -v * z], v);
  }
  // Gaussian elimination with partial pivoting.
  const n = 8;
  const m = ata.map((r, i) => [...r, atb[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((r, i) => r[n] / r[i]);
}

const H = fitHomography(CONTROL);

function ground(x: number, z: number): [number, number] {
  const w = H[6] * x + H[7] * z + 1;
  return [(H[0] * x + H[1] * z + H[2]) / w, (H[3] * x + H[4] * z + H[5]) / w];
}

/** Picture pixels per metre on the ground at a plan point (also used for heights). */
export function groundScale(x: number, z: number): number {
  const [u0, v0] = ground(x, z);
  const [u1, v1] = ground(x + 1, z);
  return Math.hypot(u1 - u0, v1 - v0);
}

/** Heights look shorter than ground distances in the oblique render. */
const HEIGHT_FACTOR = 0.75;
const EDGE = 6;
const TOP_BAND = 90;

/** Plan position (with height) → picture pixel, kept inside the picture. */
export function toImage(p: Vec3): { u: number; v: number } {
  const [u, v] = ground(p.x, p.z);
  let lifted = v - p.y * groundScale(p.x, p.z) * HEIGHT_FACTOR;
  // The back of the dome is at the very top of the picture: ease positions into that band instead of piling them on the edge.
  if (lifted < TOP_BAND) lifted = TOP_BAND - (TOP_BAND - lifted) * 0.35;
  return { u: Math.min(REFERENCE_IMAGE.width - EDGE, Math.max(EDGE, u)), v: Math.min(REFERENCE_IMAGE.height - EDGE, Math.max(EDGE, lifted)) };
}
