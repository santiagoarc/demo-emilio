import {
  FOOTPRINT,
  INNER_RATIO,
  LEVEL_BY_ID,
  MONITOR_ZONES,
  MONITOR_ZONE_BY_ID,
  zoneAt,
  type AviaryStructure,
  type AviaryTree,
  type Detection,
  type LevelId,
  type MassClass,
  type MonitorBird,
  type MonitorSpecies,
  type MonitorZone,
  type Stay,
  type TrackingDataset,
  type TrackingMethod,
  type TrackingSource,
  type TreeForm,
  type Vec3,
} from "@/domain/aviaryTracking";
import { between, chance, hashSeed, mulberry32, pick, type Rng } from "@/logic/rng";
import { DAY, HOUR, MIN, startOfDay } from "@/logic/time";

/**
 * Simulated tracking scenario for the 3D monitor.
 *
 * The species catalogue is illustrative (birds typical of tropical aviaries),
 * not SeaWorld's list; counts are demo roster sizes. Trees, devices, stays and
 * detections are generated from a seed so the demo is stable between loads.
 */

export const TRACKING_HISTORY_DAYS = 7;

const S = (
  code: string,
  common: string,
  scientific: string,
  group: MonitorSpecies["group"],
  mass: MassClass,
  color: string,
  prefLevels: LevelId[],
  prefZones: string[],
  demoCount: number,
): MonitorSpecies => ({ id: code.toLowerCase(), code, common, scientific, group, mass, color, prefLevels, prefZones, demoCount });

/** Illustrative catalogue of 30 species. Not confirmed for The Rainforest. */
export const MONITOR_SPECIES: MonitorSpecies[] = [
  S("TUC", "Keel-billed toucan", "Ramphastos sulfuratus", "toucan", "medium", "#F59E0B", ["l2", "l3", "upper"], ["canopy", "nesting", "feeding"], 22),
  S("TOC", "Toco toucan", "Ramphastos toco", "toucan", "medium", "#EA7A0B", ["l2", "l3", "upper"], ["canopy", "nesting"], 14),
  S("ARC", "Green aracari", "Pteroglossus viridis", "toucan", "small", "#84CC16", ["l2", "l3"], ["canopy", "mangrove"], 12),
  S("BYM", "Blue-and-yellow macaw", "Ara ararauna", "parrot", "large", "#2563EB", ["l2", "l3", "upper"], ["canopy", "nesting", "feeding"], 18),
  S("SCM", "Scarlet macaw", "Ara macao", "parrot", "large", "#DC2626", ["l2", "l3", "upper"], ["canopy", "nesting"], 16),
  S("GWM", "Green-winged macaw", "Ara chloropterus", "parrot", "large", "#9F1239", ["l2", "l3", "upper"], ["canopy", "nesting", "feeding"], 14),
  S("AMZ", "Yellow-crowned amazon", "Amazona ochrocephala", "parrot", "medium", "#4D7C0F", ["l1", "l2", "l3"], ["canopy", "mangrove", "feeding"], 24),
  S("SUN", "Sun conure", "Aratinga solstitialis", "parrot", "small", "#F97316", ["l1", "l2", "l3"], ["feeding", "canopy", "entrance"], 36),
  S("ECL", "Eclectus parrot", "Eclectus roratus", "parrot", "medium", "#15803D", ["l2", "l3"], ["canopy", "nesting"], 12),
  S("LOR", "Rainbow lorikeet", "Trichoglossus moluccanus", "parrot", "small", "#7C3AED", ["l1", "l2"], ["feeding", "entrance", "canopy"], 50),
  S("FLM", "Caribbean flamingo", "Phoenicopterus ruber", "flamingo", "large", "#EC4899", ["ground"], ["lagoon", "mangrove"], 42),
  S("SPB", "Roseate spoonbill", "Platalea ajaja", "other", "large", "#F472B6", ["ground", "l1"], ["lagoon", "mangrove"], 14),
  S("SIB", "Scarlet ibis", "Eudocimus ruber", "other", "medium", "#EF4444", ["ground", "l1", "l2"], ["mangrove", "lagoon"], 24),
  S("EGR", "Cattle egret", "Bubulcus ibis", "other", "medium", "#94A3B8", ["ground", "l1"], ["lagoon", "mangrove", "feeding"], 16),
  S("BBH", "Boat-billed heron", "Cochlearius cochlearius", "other", "medium", "#64748B", ["l1", "l2"], ["mangrove", "waterfall"], 8),
  S("SBT", "Sunbittern", "Eurypyga helias", "other", "medium", "#A16207", ["ground", "l1"], ["waterfall", "mangrove"], 6),
  S("HOA", "Hoatzin", "Opisthocomus hoazin", "other", "medium", "#9A3412", ["l1", "l2"], ["mangrove"], 10),
  S("VCP", "Victoria crowned pigeon", "Goura victoria", "other", "large", "#60A5FA", ["ground", "l1"], ["feeding", "nesting", "entrance"], 10),
  S("NIC", "Nicobar pigeon", "Caloenas nicobarica", "other", "medium", "#0D9488", ["ground", "l1"], ["feeding", "entrance"], 26),
  S("GBT", "Great blue turaco", "Corythaeola cristata", "other", "large", "#0EA5E9", ["l2", "l3"], ["canopy", "nesting"], 8),
  S("VTU", "Violet turaco", "Musophaga violacea", "other", "medium", "#6D28D9", ["l2", "l3"], ["canopy", "nesting"], 10),
  S("JAC", "Northern jacana", "Jacana spinosa", "other", "small", "#92400E", ["ground"], ["lagoon", "waterfall"], 12),
  S("KNG", "Amazon kingfisher", "Chloroceryle amazona", "other", "small", "#0F766E", ["l1", "l2"], ["waterfall", "lagoon"], 6),
  S("MOT", "Blue-crowned motmot", "Momotus momota", "other", "small", "#0284C7", ["l1", "l2"], ["canopy", "mangrove"], 10),
  S("HON", "Red-legged honeycreeper", "Cyanerpes cyaneus", "other", "tiny", "#1D4ED8", ["l2", "l3", "upper"], ["canopy", "feeding"], 24),
  S("TAN", "Silver-beaked tanager", "Ramphocelus carbo", "other", "tiny", "#7F1D1D", ["l1", "l2", "l3"], ["canopy", "feeding", "entrance"], 22),
  S("GBS", "Golden-breasted starling", "Lamprotornis regius", "other", "small", "#CA8A04", ["l1", "l2"], ["feeding", "entrance"], 18),
  S("ORO", "Crested oropendola", "Psarocolius decumanus", "other", "medium", "#854D0E", ["l2", "l3", "upper"], ["canopy", "nesting"], 10),
  S("HAM", "Hammerkop", "Scopus umbretta", "other", "medium", "#78716C", ["ground", "l1"], ["waterfall", "lagoon"], 6),
  S("WDK", "Fulvous whistling duck", "Dendrocygna bicolor", "other", "medium", "#B45309", ["ground"], ["lagoon", "mangrove"], 20),
];

export const MONITOR_SPECIES_BY_ID = Object.fromEntries(MONITOR_SPECIES.map((s) => [s.id, s])) as Record<string, MonitorSpecies>;

const NAMES = ["Mango", "Kiwi", "Sol", "Coral", "Pico", "Luna", "Zara", "Tango", "Rio", "Nova", "Sunny", "Azul", "Jade", "Ruby", "Olive", "Indy", "Saffron", "Echo"];

/** Which methods are plausible per body-mass class, with demo weights. */
const METHOD_MIX: Record<MassClass, [TrackingMethod, number][]> = {
  large: [["tag-3d", 0.85], ["tag-zone", 0.1], ["visual", 0.05]],
  medium: [["tag-3d", 0.6], ["tag-zone", 0.3], ["visual", 0.1]],
  small: [["tag-zone", 0.55], ["visual", 0.4], ["none", 0.05]],
  tiny: [["visual", 0.75], ["none", 0.25]],
};

function weighted<T>(rng: Rng, items: [T, number][]): T {
  let r = rng() * items.reduce((a, [, w]) => a + w, 0);
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[items.length - 1][0];
}

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

function blocked(x: number, z: number) {
  if ((x / LAGOON.rx) ** 2 + (z / LAGOON.rz) ** 2 < 1.15) return true;
  if (Math.hypot(x - WATERFALL_POOL.x, z - WATERFALL_POOL.z) < WATERFALL_POOL.r + 3) return true;
  if (x < -36 && Math.abs(z) < 5) return true;
  return false;
}

const TREES_PER_ZONE: Record<string, { n: number; forms: [TreeForm, number][] }> = {
  canopy: { n: 9, forms: [["emergent", 0.55], ["broadleaf", 0.45]] },
  nesting: { n: 6, forms: [["emergent", 0.4], ["broadleaf", 0.6]] },
  mangrove: { n: 7, forms: [["broadleaf", 0.8], ["palm", 0.2]] },
  waterfall: { n: 4, forms: [["broadleaf", 0.5], ["palm", 0.5]] },
  feeding: { n: 6, forms: [["palm", 0.5], ["broadleaf", 0.5]] },
  entrance: { n: 3, forms: [["palm", 0.7], ["broadleaf", 0.3]] },
  lagoon: { n: 4, forms: [["palm", 1]] },
};

function generateTrees(rng: Rng): AviaryTree[] {
  const placed: { x: number; z: number; zoneId: string; form: TreeForm }[] = [];
  for (const zone of MONITOR_ZONES) {
    const spec = TREES_PER_ZONE[zone.id];
    const rRange: [number, number] = zone.sector ? [INNER_RATIO + 0.08, 0.86] : [0.31, INNER_RATIO - 0.02];
    let tries = 0;
    let count = 0;
    while (count < spec.n && tries++ < 600) {
      const p = pointInZone(rng, zone, rRange);
      if (blocked(p.x, p.z) || zoneAt(p.x, p.z)?.id !== zone.id) continue;
      if (placed.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 9)) continue;
      placed.push({ ...p, zoneId: zone.id, form: weighted(rng, spec.forms) });
      count++;
    }
  }
  return placed.map((p, i) => {
    const h = p.form === "emergent" ? between(rng, 18.5, 24) : p.form === "broadleaf" ? between(rng, 9, 16.5) : between(rng, 7, 13);
    const heightM = Math.round(h * 10) / 10;
    const tiers = p.form === "emergent" ? [0.42, 0.58, 0.72, 0.86] : p.form === "broadleaf" ? [0.4, 0.6, 0.8] : [0.9];
    return {
      id: `T${i + 1}`,
      plantSpecies: null,
      form: p.form,
      x: Math.round(p.x * 10) / 10,
      z: Math.round(p.z * 10) / 10,
      zoneId: p.zoneId,
      heightM,
      crownRadiusM: Math.round((p.form === "emergent" ? between(rng, 6, 8) : p.form === "broadleaf" ? between(rng, 4, 6) : between(rng, 2.8, 3.8)) * 10) / 10,
      branchTiersM: tiers.map((t) => Math.round(heightM * t * 10) / 10),
      simulated: true as const,
    };
  });
}

export const STRUCTURES: AviaryStructure[] = [
  { id: "S1", name: "Feeding platform", kind: "platform", x: -6, z: 27, heightM: 3, zoneId: "feeding" },
  { id: "S2", name: "Canopy walkway", kind: "walkway", x: 4, z: -25, heightM: 6, zoneId: "canopy" },
];

/** Position for a stay at a given level: on a tree, a structure or the ground. */
function placeStay(rng: Rng, zone: MonitorZone, levelId: LevelId, trees: AviaryTree[]): Pick<Stay, "zoneId" | "treeId" | "structureId" | "pos"> {
  const level = LEVEL_BY_ID[levelId];
  if (levelId !== "ground") {
    const fits = trees.filter((t) => t.zoneId === zone.id && t.heightM > Math.max(level.min, 1) + 0.8);
    if (fits.length) {
      const t = pick(rng, fits);
      const ang = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * t.crownRadiusM * 0.75;
      const lo = Math.max(level.min, 1.2);
      const hi = Math.min(level.max, t.heightM - 0.3);
      const y = between(rng, lo, Math.max(lo, hi));
      return { zoneId: zone.id, treeId: t.id, structureId: null, pos: { x: t.x + Math.cos(ang) * d, y, z: t.z + Math.sin(ang) * d } };
    }
    const st = STRUCTURES.find((s) => s.zoneId === zone.id);
    if (st) return { zoneId: zone.id, treeId: null, structureId: st.id, pos: { x: st.x + between(rng, -3, 3), y: st.heightM + 0.3, z: st.z + between(rng, -1.5, 1.5) } };
  }
  const p = pointInZone(rng, zone);
  return { zoneId: zone.id, treeId: null, structureId: null, pos: { x: p.x, y: between(rng, 0, 0.3), z: p.z } };
}

export function generateTracking(now: number, seed = 20261028): TrackingDataset {
  const rng = mulberry32(hashSeed("aviary-tracking", seed));
  const windowStart = startOfDay(now) - (TRACKING_HISTORY_DAYS - 1) * DAY;
  const trees = generateTrees(rng);
  const birds: MonitorBird[] = [];
  const stays = new Map<string, Stay[]>();

  for (const sp of MONITOR_SPECIES) {
    for (let i = 1; i <= sp.demoCount; i++) {
      const id = `${sp.code}-${String(i).padStart(3, "0")}`;
      const method = weighted(rng, METHOD_MIX[sp.mass]);
      const tagged = method === "tag-3d" || method === "tag-zone";
      const status = !tagged ? "not-fitted" : weighted(rng, [["active", 0.85], ["low-battery", 0.08], ["no-signal", 0.07]] as const);
      const signalLostAt = status === "no-signal" ? now - Math.round(between(rng, 8, 60)) * HOUR : null;
      birds.push({
        id,
        speciesId: sp.id,
        name: chance(rng, 0.1) ? pick(rng, NAMES) : undefined,
        method,
        device: {
          id: tagged ? `DEV-${hashSeed(id, seed).toString(16).slice(0, 5).toUpperCase()}` : "—",
          category: tagged ? "Tracker · technology to be selected" : "None",
          status,
          batteryPct: !tagged ? null : status === "low-battery" ? Math.round(between(rng, 6, 18)) : Math.round(between(rng, 35, 98)),
        },
        signalLostAt,
        simulated: true,
      });

      // Stays: a home zone most of the time, a night roost, shorter stays by day.
      const home = MONITOR_ZONE_BY_ID[pick(rng, sp.prefZones)];
      const roostLevel = sp.prefLevels[sp.prefLevels.length - 1];
      const roost = placeStay(rng, home, roostLevel, trees);
      // Each bird settles and wakes at its own time, so dusk and dawn are gradual.
      const sleepAt = between(rng, 18.4, 20.6);
      const wakeAt = between(rng, 5.6, 6.8);
      const list: Stay[] = [];
      let t = windowStart;
      while (t < now) {
        const hour = new Date(t).getHours() + new Date(t).getMinutes() / 60;
        const night = hour >= sleepAt || hour < wakeAt;
        let place: Pick<Stay, "zoneId" | "treeId" | "structureId" | "pos">;
        let dur: number;
        if (night) {
          place = roost;
          const wake = startOfDay(t) + (hour >= sleepAt ? DAY : 0) + Math.round(wakeAt * 60) * MIN;
          dur = Math.max(10 * MIN, wake - t);
        } else {
          const zone = chance(rng, 0.7) ? home : MONITOR_ZONE_BY_ID[pick(rng, sp.prefZones)];
          place = placeStay(rng, zone, pick(rng, sp.prefLevels), trees);
          dur = Math.round(Math.exp(between(rng, Math.log(12), Math.log(150)))) * MIN;
          // Do not run past bedtime by more than a few minutes.
          const bed = startOfDay(t) + Math.round(sleepAt * 60) * MIN;
          if (t < bed && t + dur > bed) dur = Math.max(5 * MIN, bed - t);
        }
        const end = Math.min(t + dur, now + DAY);
        list.push({ birdId: id, start: t, end, ...place });
        t = end + Math.round(between(rng, 1, 5) * 60) * 1000; // transit
      }
      stays.set(id, list);
    }
  }

  return { now, windowStart, species: MONITOR_SPECIES, birds, trees, structures: STRUCTURES, stays };
}

/* ---------- Simulated TrackingSource ---------- */

const unit = (...p: (string | number)[]) => hashSeed(...p) / 4294967296;

const SAMPLE_MS: Record<TrackingMethod, number> = { "tag-3d": MIN, "tag-zone": 3 * MIN, visual: 0, none: 0 };

/** Index of the last stay starting at or before t (binary search). */
function stayIndex(list: Stay[], t: number) {
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

/** Visual-only birds are seen in some stays only: by a camera or a keeper. */
function sightingIn(birdId: string, s: Stay): { at: number; source: "camera" | "keeper" } | null {
  const u = unit(birdId, s.start, "seen");
  if (u > 0.4) return null;
  return { at: s.start + Math.round((s.end - s.start) * unit(birdId, s.start, "when")), source: u < 0.25 ? "camera" : "keeper" };
}

const lerp = (a: Vec3, b: Vec3, f: number): Vec3 => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });

export function trackingSource(ds: TrackingDataset): TrackingSource {
  const birdById = new Map(ds.birds.map((b) => [b.id, b]));
  const treeById = new Map(ds.trees.map((t) => [t.id, t]));

  const treeFor = (treeId: string | null, precisionM: number) => {
    const tree = treeId ? treeById.get(treeId) : undefined;
    // A tree is only reported when the uncertainty fits inside its crown.
    return tree && precisionM <= tree.crownRadiusM ? tree.id : null;
  };

  function latest(birdId: string, asOf: number): Detection | null {
    const bird = birdById.get(birdId);
    const list = ds.stays.get(birdId);
    if (!bird || !list || bird.method === "none") return null;
    const t = Math.min(asOf, bird.signalLostAt ?? asOf);
    let i = stayIndex(list, t);
    if (i < 0) return null;

    if (bird.method === "visual") {
      for (let k = 0; k < 300 && i >= 0; k++, i--) {
        const s = list[i];
        const seen = sightingIn(birdId, s);
        if (!seen || seen.at > t) continue;
        const precisionM = seen.source === "camera" ? 0.5 : 2;
        return {
          birdId, at: seen.at, kind: "confirmed", source: seen.source, zoneId: s.zoneId, pos: s.pos, precisionM,
          treeId: treeFor(s.treeId, precisionM), moving: false, simulated: true,
        };
      }
      return null;
    }

    const iv = SAMPLE_MS[bird.method];
    const s = list[i];
    const next = list[i + 1];
    let at: number;
    let pos: Vec3;
    let moving = false;
    let zoneId = s.zoneId;
    let treeId = s.treeId;
    if (t <= s.end || !next) {
      at = s.start + Math.floor((Math.min(t, s.end) - s.start) / iv) * iv;
      if (unit(birdId, at, "drop") < 0.1 && at - iv >= s.start) at -= iv; // missed reading
      pos = s.pos;
    } else {
      at = s.end + Math.floor((t - s.end) / iv) * iv;
      pos = lerp(s.pos, next.pos, Math.min(1, (at - s.end) / Math.max(1, next.start - s.end)));
      moving = true;
      zoneId = zoneAt(pos.x, pos.z)?.id ?? s.zoneId;
      treeId = null;
    }

    if (bird.method === "tag-zone") {
      return { birdId, at, kind: "zone", source: "tracker", zoneId, pos: null, precisionM: null, treeId: null, moving: null, simulated: true };
    }

    const u = unit(birdId, at, "q");
    const confirmed = !moving && u < 0.12;
    const precisionM = confirmed ? 0.5 : Math.round((1 + u * 2.2) * (moving ? 1.8 : 1) * 10) / 10;
    // Small reading noise around the true spot, inside the uncertainty radius.
    const j = (k: string) => (unit(birdId, at, k) - 0.5) * precisionM * 0.8;
    return {
      birdId, at,
      kind: confirmed ? "confirmed" : "computed-3d",
      source: confirmed ? "fusion" : "tracker",
      zoneId,
      pos: { x: pos.x + j("x"), y: Math.max(0, pos.y + j("y")), z: pos.z + j("z") },
      precisionM,
      treeId: moving ? null : treeFor(treeId, precisionM),
      moving,
      simulated: true,
    };
  }

  function history(birdId: string, from: number, to: number): Stay[] {
    const bird = birdById.get(birdId);
    const list = ds.stays.get(birdId) ?? [];
    if (!bird || bird.method === "none") return [];
    const until = Math.min(to, bird.signalLostAt ?? to);
    return list.filter((s) => s.end >= from && s.start <= until && (bird.method !== "visual" || (sightingIn(birdId, s)?.at ?? Infinity) <= until));
  }

  return { latest, history };
}
