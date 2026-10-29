import {
  FOOTPRINT,
  INNER_RATIO,
  LEVEL_BY_ID,
  MONITOR_ZONES,
  zoneAt,
  type AgeClass,
  type AviaryTree,
  type DemoRegistry,
  type Detection,
  type DeviceStatus,
  type LevelId,
  type MonitorBird,
  type MonitorZone,
  type SignalQuality,
  type Stay,
  type TrackingDataset,
  type TrackingSource,
  type TreeForm,
  type Vec3,
} from "@/domain/aviaryTracking";
import { DISTRIBUTION_NOTE, MONITOR_SPECIES } from "@/data/aviaryCatalog";
import { FEATURE_TREES, GREAT_TREE, distToWalkways, nearPavilion, nearRocks, nearWater } from "@/domain/aviaryLayout";
import { between, chance, hashSeed, mulberry32, pick, type Rng } from "@/logic/rng";
import { DAY, HOUR, MIN, startOfDay } from "@/logic/time";

/**
 * DEMO generator for the aviary monitor.
 *
 * `generateRegistry` creates the species, the 500 individuals and the trees
 * once; the registry is then persisted (see aviaryDemoStore). Movements
 * (`buildTimeline`) and detections (`trackingSource`) are derived from the
 * registry and its seed, so the same registry always yields the same history.
 */

// v2: trees laid out after the reference render (great tree, lagoons, boardwalks).
export const REGISTRY_VERSION = 2;
/** Simulated history before the anchor, and simulated future the clock can play into. */
export const HISTORY_DAYS = 7;
export const HORIZON_DAYS = 3;

const NAMES = ["Mango", "Kiwi", "Sol", "Coral", "Pico", "Luna", "Zara", "Tango", "Rio", "Nova", "Sunny", "Azul", "Jade", "Ruby", "Olive", "Indy", "Saffron", "Echo"];

function weighted<T>(rng: Rng, items: readonly (readonly [T, number])[]): T {
  let r = rng() * items.reduce((a, [, w]) => a + w, 0);
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[items.length - 1][0];
}

/* ---------- layout ---------- */

/** Unit-ellipse radius range of each zone (share of the footprint). */
function radialRange(zone: MonitorZone): [number, number] {
  return zone.sector ? [INNER_RATIO + 0.04, 0.93] : [0.12, INNER_RATIO - 0.02];
}

function pointInZone(rng: Rng, zone: MonitorZone, rRange = radialRange(zone)): { x: number; z: number } {
  const [a0, a1] = zone.sector ?? [0, 360];
  const deg = between(rng, a0 + 2, a1 - 2);
  const r = Math.sqrt(between(rng, rRange[0] ** 2, rRange[1] ** 2));
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) * r * FOOTPRINT.rx, z: Math.sin(rad) * r * FOOTPRINT.rz };
}

/** Trunks stay out of the water, rocks, boardwalks, pavilions and the great tree's crown. */
function blocked(x: number, z: number) {
  return (
    nearWater(x, z, 1.5) ||
    nearRocks(x, z, 1.5) ||
    distToWalkways(x, z) < 2 ||
    nearPavilion(x, z, 2) ||
    Math.hypot(x - GREAT_TREE.x, z - GREAT_TREE.z) < GREAT_TREE.crownRadiusM - 1
  );
}

/** Extra trees per zone, filled in around the great tree and the feature trees. */
const TREES_PER_ZONE: Record<string, { n: number; forms: [TreeForm, number][] }> = {
  canopy: { n: 8, forms: [["emergent", 0.4], ["broadleaf", 0.4], ["palm", 0.2]] },
  nesting: { n: 5, forms: [["broadleaf", 0.6], ["palm", 0.4]] },
  mangrove: { n: 6, forms: [["broadleaf", 0.7], ["palm", 0.3]] },
  waterfall: { n: 5, forms: [["broadleaf", 0.5], ["palm", 0.5]] },
  feeding: { n: 6, forms: [["palm", 0.5], ["broadleaf", 0.5]] },
  entrance: { n: 4, forms: [["palm", 0.7], ["broadleaf", 0.3]] },
  lagoon: { n: 6, forms: [["palm", 0.7], ["broadleaf", 0.3]] },
  greattree: { n: 0, forms: [["palm", 1]] },
};

/** Illustrative plant names for demo trees, by form. Not a survey of the aviary. */
const DEMO_PLANTS: Record<TreeForm, string[]> = {
  emergent: ["Ceiba", "Kapok", "Mahogany", "Rain tree"],
  broadleaf: ["Strangler fig", "Cecropia", "Inga", "Banyan", "Mango"],
  palm: ["Royal palm", "Foxtail palm", "Areca palm", "Coconut palm"],
};

/** Demo plant name for a tree, stable for its ID. The great tree is the Ceiba of the render. */
export function demoPlant(t: Pick<AviaryTree, "id" | "form">) {
  if (t.id === "T1") return "Ceiba (great tree)";
  const list = DEMO_PLANTS[t.form];
  return list[hashSeed("plant", t.id) % list.length];
}

function generateTrees(rng: Rng): AviaryTree[] {
  type P = { x: number; z: number; form: TreeForm; h?: number; crown?: number };
  // T1 is the great central tree; then the prominent trees of the render; then the fill.
  const placed: P[] = [
    { x: GREAT_TREE.x, z: GREAT_TREE.z, form: "emergent", h: GREAT_TREE.heightM, crown: GREAT_TREE.crownRadiusM },
    ...FEATURE_TREES.map((t) => ({ x: t.x, z: t.z, form: t.form, h: t.h, crown: t.crown })),
  ];
  for (const zone of MONITOR_ZONES) {
    const spec = TREES_PER_ZONE[zone.id];
    let count = 0;
    for (let tries = 0; count < spec.n && tries < 1500; tries++) {
      const p = pointInZone(rng, zone);
      if (blocked(p.x, p.z) || zoneAt(p.x, p.z)?.id !== zone.id) continue;
      if (placed.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 7.5)) continue;
      placed.push({ ...p, form: weighted(rng, spec.forms) });
      count++;
    }
  }
  return placed.map((p, i) => {
    const h = p.h ?? (p.form === "emergent" ? between(rng, 18.5, 24) : p.form === "broadleaf" ? between(rng, 9, 16.5) : between(rng, 7, 13));
    const heightM = Math.round(h * 10) / 10;
    const tiers = p.form === "emergent" ? [0.42, 0.58, 0.72, 0.86] : p.form === "broadleaf" ? [0.4, 0.6, 0.8] : [0.9];
    const crown = p.crown ?? (p.form === "emergent" ? between(rng, 6, 8) : p.form === "broadleaf" ? between(rng, 4, 6) : between(rng, 2.8, 3.8));
    const id = `T${i + 1}`;
    return {
      id,
      plantSpecies: demoPlant({ id, form: p.form }),
      form: p.form,
      x: Math.round(p.x * 10) / 10,
      z: Math.round(p.z * 10) / 10,
      zoneId: zoneAt(p.x, p.z)?.id ?? "greattree",
      heightM,
      crownRadiusM: Math.round(crown * 10) / 10,
      branchTiersM: tiers.map((t) => Math.round(heightM * t * 10) / 10),
      simulated: true as const,
    };
  });
}

/* ---------- registry (persisted) ---------- */

function ageClassOf(age: number, maxAge: number): AgeClass {
  if (age < 1) return "juvenile";
  if (age < Math.max(2, maxAge * 0.12)) return "subadult";
  if (age > maxAge * 0.75) return "senior";
  return "adult";
}

/** Demo clock origin: 10:00 local time today, so the demo opens with daytime activity. */
export function defaultAnchor(at = Date.now()) {
  return startOfDay(at) + 10 * HOUR;
}

export function generateRegistry(seed = 20261028, anchor = defaultAnchor()): DemoRegistry {
  const rng = mulberry32(hashSeed("aviary-registry", seed));
  const trees = generateTrees(rng);
  const birds: MonitorBird[] = [];
  for (const sp of MONITOR_SPECIES) {
    for (let seq = 1; seq <= sp.demoCount; seq++) {
      const id = `${sp.code}-${String(seq).padStart(3, "0")}`;
      const ageYears = Math.round((0.3 + (sp.maxAge * 0.8 - 0.3) * rng() ** 1.5) * 10) / 10;
      const ageClass = ageClassOf(ageYears, sp.maxAge);
      const status = weighted<DeviceStatus>(rng, [["active", 0.84], ["low-battery", 0.06], ["intermittent", 0.06], ["no-signal", 0.04]]);
      birds.push({
        id,
        speciesId: sp.id,
        seq,
        name: chance(rng, 0.08) ? pick(rng, NAMES) : undefined,
        ageYears,
        ageClass,
        sex: sp.dimorphic && ageClass !== "juvenile" ? (chance(rng, sp.group === "galliform" ? 0.4 : 0.5) ? "male" : "female") : null,
        homeZoneId: pick(rng, sp.prefZones),
        device: {
          id: `DEV-${hashSeed(id, seed).toString(16).slice(0, 5).toUpperCase()}`,
          category: "Tracker · demo device",
          status,
          batteryPct: status === "low-battery" ? Math.round(between(rng, 6, 18)) : status === "no-signal" ? 0 : Math.round(between(rng, 35, 98)),
        },
        signalLostAt: status === "no-signal" ? anchor - Math.round(between(rng, 7, 40)) * HOUR : null,
        simulated: true,
      });
    }
  }
  return { version: REGISTRY_VERSION, seed, anchor, createdAt: Date.now(), species: MONITOR_SPECIES, birds, trees, distributionNote: DISTRIBUTION_NOTE };
}

/* ---------- movements (derived) ---------- */

/** A stay by a tree of the zone, at the requested level when a tree is tall enough. */
function placeStay(rng: Rng, zoneId: string, levelId: LevelId, trees: AviaryTree[]): Pick<Stay, "zoneId" | "treeId" | "inCrown" | "pos"> {
  const inZone = trees.filter((t) => t.zoneId === zoneId);
  const pool = inZone.length ? inZone : trees;
  const ang = rng() * Math.PI * 2;
  if (levelId === "ground") {
    const t = pick(rng, pool);
    const d = Math.sqrt(rng()) * t.crownRadiusM * 0.9;
    return { zoneId: t.zoneId, treeId: t.id, inCrown: false, pos: { x: t.x + Math.cos(ang) * d, y: between(rng, 0, 0.3), z: t.z + Math.sin(ang) * d } };
  }
  const level = LEVEL_BY_ID[levelId];
  const tall = pool.filter((t) => t.heightM > Math.max(level.min, 1) + 0.8);
  const t = tall.length ? pick(rng, tall) : pool.reduce((a, b) => (b.heightM > a.heightM ? b : a));
  const d = Math.sqrt(rng()) * t.crownRadiusM * 0.75;
  const lo = Math.min(Math.max(level.min, 1.2), t.heightM - 0.5);
  const hi = Math.min(level.max, t.heightM - 0.3);
  const y = Math.round(between(rng, lo, Math.max(lo, hi)) * 10) / 10;
  return { zoneId: t.zoneId, treeId: t.id, inCrown: true, pos: { x: t.x + Math.cos(ang) * d, y, z: t.z + Math.sin(ang) * d } };
}

/** Ground-to-ground hops over a short distance are walked; anything else is flown. */
export function isWalk(a: Pick<Stay, "inCrown" | "pos">, b: Pick<Stay, "inCrown" | "pos">) {
  return !a.inCrown && !b.inCrown && Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 25;
}

/** Travel time between two places: flying ~2–3.5 m/s, walking ~0.6 m/s, plus take-off. */
function transitMs(rng: Rng, a: Pick<Stay, "inCrown" | "pos">, b: Pick<Stay, "inCrown" | "pos">) {
  const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
  const v = isWalk(a, b) ? between(rng, 0.45, 0.75) : between(rng, 2, 3.5);
  return Math.round((Math.min(150, Math.max(4, d / v)) + between(rng, 2, 6)) * 1000);
}

export function buildTimeline(registry: DemoRegistry): TrackingDataset {
  const windowStart = startOfDay(registry.anchor) - (HISTORY_DAYS - 1) * DAY;
  const horizon = registry.anchor + HORIZON_DAYS * DAY;
  const spById = new Map(registry.species.map((s) => [s.id, s]));
  const stays = new Map<string, Stay[]>();

  for (const bird of registry.birds) {
    // One generator per bird: the history of a bird never depends on the others.
    const rng = mulberry32(hashSeed("aviary-moves", registry.seed, bird.id));
    const sp = spById.get(bird.speciesId)!;
    const roost = placeStay(rng, bird.homeZoneId, sp.prefLevels[sp.prefLevels.length - 1], registry.trees);
    // Each bird settles and wakes at its own time, so dusk and dawn are gradual.
    const sleepAt = between(rng, 18.4, 20.6);
    const wakeAt = between(rng, 5.6, 6.8);
    const list: Stay[] = [];
    let t = windowStart;
    while (t < horizon) {
      const hour = new Date(t).getHours() + new Date(t).getMinutes() / 60;
      const night = hour >= sleepAt || hour < wakeAt;
      let place: Pick<Stay, "zoneId" | "treeId" | "inCrown" | "pos">;
      let dur: number;
      if (night) {
        place = roost;
        const wake = startOfDay(t) + (hour >= sleepAt ? DAY : 0) + Math.round(wakeAt * 60) * MIN;
        dur = Math.max(10 * MIN, wake - t);
      } else {
        const zoneId = chance(rng, 0.7) ? bird.homeZoneId : pick(rng, sp.prefZones);
        place = placeStay(rng, zoneId, pick(rng, sp.prefLevels), registry.trees);
        dur = Math.round(Math.exp(between(rng, Math.log(12), Math.log(150)))) * MIN;
        const bed = startOfDay(t) + Math.round(sleepAt * 60) * MIN;
        if (t < bed && t + dur > bed) dur = Math.max(5 * MIN, bed - t);
      }
      const prev = list[list.length - 1];
      // The bird leaves at t and arrives after the trip; the stay starts on arrival.
      const start = prev ? t + transitMs(rng, prev, place) : t;
      list.push({ id: `${bird.id}#${list.length + 1}`, birdId: bird.id, start, end: start + dur, ...place });
      t = start + dur;
    }
    stays.set(bird.id, list);
  }
  return { registry, windowStart, horizon, stays };
}

/* ---------- detections (derived) ---------- */

const unit = (...p: (string | number)[]) => hashSeed(...p) / 4294967296;

/** Reading interval of the demo devices. */
const SAMPLE_MS = 15_000;

/** Index of the last stay starting at or before t (binary search). */
export function stayIndex(list: Stay[], t: number) {
  let lo = 0, hi = list.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].start <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

const lerp = (a: Vec3, b: Vec3, f: number): Vec3 => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });

function signalFor(precisionM: number | null): SignalQuality {
  if (precisionM == null) return "weak";
  return precisionM <= 1.5 ? "good" : precisionM <= 2.6 ? "fair" : "weak";
}

export function trackingSource(ds: TrackingDataset): TrackingSource {
  const birdById = new Map(ds.registry.birds.map((b) => [b.id, b]));
  const treeById = new Map(ds.registry.trees.map((t) => [t.id, t]));

  function latest(birdId: string, asOf: number): Detection | null {
    const bird = birdById.get(birdId);
    const list = ds.stays.get(birdId);
    if (!bird || !list) return null;
    const t = Math.min(asOf, bird.signalLostAt ?? asOf);
    const i = stayIndex(list, t);
    if (i < 0) return null;

    const s = list[i];
    const next = list[i + 1];
    let at: number;
    let pos: Vec3;
    let moving = false;
    let zoneId = s.zoneId;
    if (t <= s.end || !next) {
      at = s.start + Math.floor((Math.min(t, s.end) - s.start) / SAMPLE_MS) * SAMPLE_MS;
      if (unit(birdId, at, "drop") < 0.1 && at - SAMPLE_MS >= s.start) at -= SAMPLE_MS; // missed reading
      pos = s.pos;
    } else {
      // In flight the position is continuous: eased along the way, with an arc in height.
      at = t;
      const f = Math.min(1, (t - s.end) / Math.max(1, next.start - s.end));
      const e = f * f * (3 - 2 * f);
      pos = lerp(s.pos, next.pos, e);
      if (!isWalk(s, next)) {
        const d = Math.hypot(s.pos.x - next.pos.x, s.pos.z - next.pos.z);
        pos = { ...pos, y: Math.min(FOOTPRINT.domeHeight - 1, pos.y + Math.sin(Math.PI * f) * Math.min(5, d * 0.18)) };
      }
      moving = true;
      zoneId = zoneAt(pos.x, pos.z)?.id ?? s.zoneId;
    }

    const u = unit(birdId, at, "q");
    if (bird.device.status === "intermittent" && u < 0.7) {
      return { birdId, at, kind: "zone", source: "tracker", zoneId, pos: null, precisionM: null, treeId: null, moving: null, signal: "weak", confidence: 0.35, simulated: true };
    }
    const confirmed = !moving && u < 0.12;
    const widen = bird.device.status === "intermittent" ? 1.6 : 1;
    const precisionM = confirmed ? 0.5 : Math.round((1 + u * 2.2) * (moving ? 1.8 : 1) * widen * 10) / 10;
    // Reading noise around the true spot, inside the uncertainty radius; never above the tree.
    const j = (k: string) => (unit(birdId, at, k) - 0.5) * precisionM * 0.6;
    const tree = treeById.get(s.treeId)!;
    const y = moving ? pos.y : Math.min(tree.heightM, Math.max(0, pos.y + (s.inCrown ? j("y") : 0)));
    const confidence = confirmed ? 0.97 : Math.max(0.45, Math.min(0.92, 0.95 - (precisionM - 1) * 0.16)) * (moving ? 0.85 : 1);
    return {
      birdId, at,
      kind: confirmed ? "confirmed" : "computed-3d",
      source: confirmed ? "fusion" : "tracker",
      zoneId,
      pos: { x: pos.x + j("x"), y: Math.round(y * 10) / 10, z: pos.z + j("z") },
      precisionM,
      treeId: moving || precisionM > tree.crownRadiusM ? null : s.treeId,
      moving,
      signal: confirmed ? "good" : signalFor(precisionM),
      confidence: Math.round(confidence * 100) / 100,
      simulated: true,
    };
  }

  function history(birdId: string, from: number, to: number): Stay[] {
    const bird = birdById.get(birdId);
    const list = ds.stays.get(birdId) ?? [];
    if (!bird) return [];
    const until = Math.min(to, bird.signalLostAt ?? to);
    return list.filter((s) => s.end >= from && s.start <= until);
  }

  return { latest, history };
}
