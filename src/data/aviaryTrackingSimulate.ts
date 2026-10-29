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

export const REGISTRY_VERSION = 1;
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
  return zone.sector ? [INNER_RATIO + 0.04, 0.95] : [0, INNER_RATIO - 0.03];
}

function pointInZone(rng: Rng, zone: MonitorZone, rRange = radialRange(zone)): { x: number; z: number } {
  const [a0, a1] = zone.sector ?? [0, 360];
  const deg = between(rng, a0 + 2, a1 - 2);
  const r = Math.sqrt(between(rng, rRange[0] ** 2, rRange[1] ** 2));
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) * r * FOOTPRINT.rx, z: Math.sin(rad) * r * FOOTPRINT.rz };
}

/** Lagoon water, waterfall pool and the entrance path are kept free of trees. */
export const LAGOON = { rx: FOOTPRINT.rx * 0.29, rz: FOOTPRINT.rz * 0.29 };
export const WATERFALL_POOL = { x: 46, z: 2, r: 7 };

/** Decorative structures drawn by the scene. */
export const STRUCTURES = [
  { id: "S1", name: "Feeding platform", kind: "platform" as const, x: -6, z: 27, heightM: 3 },
  { id: "S2", name: "Canopy walkway", kind: "walkway" as const, x: 4, z: -25, heightM: 6 },
];

function blocked(x: number, z: number) {
  if ((x / LAGOON.rx) ** 2 + (z / LAGOON.rz) ** 2 < 1.15) return true;
  if (Math.hypot(x - WATERFALL_POOL.x, z - WATERFALL_POOL.z) < WATERFALL_POOL.r + 3) return true;
  if (x < -36 && Math.abs(z) < 5) return true;
  if (Math.hypot(x - STRUCTURES[0].x, z - STRUCTURES[0].z) < 6) return true;
  return false;
}

const TREES_PER_ZONE: Record<string, { n: number; forms: [TreeForm, number][] }> = {
  canopy: { n: 10, forms: [["emergent", 0.55], ["broadleaf", 0.45]] },
  nesting: { n: 7, forms: [["emergent", 0.4], ["broadleaf", 0.6]] },
  mangrove: { n: 8, forms: [["broadleaf", 0.8], ["palm", 0.2]] },
  waterfall: { n: 5, forms: [["broadleaf", 0.5], ["palm", 0.5]] },
  feeding: { n: 7, forms: [["palm", 0.4], ["broadleaf", 0.6]] },
  entrance: { n: 4, forms: [["palm", 0.6], ["broadleaf", 0.4]] },
  lagoon: { n: 5, forms: [["palm", 1]] },
};

function generateTrees(rng: Rng): AviaryTree[] {
  const placed: { x: number; z: number; zoneId: string; form: TreeForm }[] = [];
  for (const zone of MONITOR_ZONES) {
    const spec = TREES_PER_ZONE[zone.id];
    const rRange: [number, number] = zone.sector ? [INNER_RATIO + 0.08, 0.88] : [0.31, INNER_RATIO - 0.02];
    let count = 0;
    for (let tries = 0; count < spec.n && tries < 800; tries++) {
      const p = pointInZone(rng, zone, rRange);
      if (blocked(p.x, p.z) || zoneAt(p.x, p.z)?.id !== zone.id) continue;
      if (placed.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 8.5)) continue;
      placed.push({ ...p, zoneId: zone.id, form: weighted(rng, spec.forms) });
      count++;
    }
  }
  return placed.map((p, i) => {
    const h = p.form === "emergent" ? between(rng, 18.5, 24) : p.form === "broadleaf" ? between(rng, 9, 16.5) : between(rng, 7, 13);
    const heightM = Math.round(h * 10) / 10;
    const tiers = p.form === "emergent" ? [0.42, 0.58, 0.72, 0.86] : p.form === "broadleaf" ? [0.4, 0.6, 0.8] : [0.9];
    const crown = p.form === "emergent" ? between(rng, 6, 8) : p.form === "broadleaf" ? between(rng, 4, 6) : between(rng, 2.8, 3.8);
    return {
      id: `T${i + 1}`,
      plantSpecies: null,
      form: p.form,
      x: Math.round(p.x * 10) / 10,
      z: Math.round(p.z * 10) / 10,
      zoneId: p.zoneId,
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
      list.push({ id: `${bird.id}#${list.length + 1}`, birdId: bird.id, start: t, end: t + dur, ...place });
      t += dur + Math.round(between(rng, 1, 5) * 60) * 1000; // transit
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
      at = s.end + Math.floor((t - s.end) / SAMPLE_MS) * SAMPLE_MS;
      pos = lerp(s.pos, next.pos, Math.min(1, (at - s.end) / Math.max(1, next.start - s.end)));
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
