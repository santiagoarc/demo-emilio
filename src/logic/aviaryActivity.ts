/**
 * Flight activity of a bird: how long it flew, walked and stayed put, and how far it went.
 * Built from the stays (where it was) and the trips between them, the same way the map
 * draws its movement. "How is it doing?" compares the last 24 h against its own previous
 * days and against its species. Not a diagnosis: it only points at what may be worth a look.
 */
import { FOOTPRINT, type MonitorBird, type Stay, type TrackingDataset } from "@/domain/aviaryTracking";
import { isWalk } from "@/data/aviaryTrackingSimulate";
import type { InsightLevel, InsightPoint } from "./insights";
import { DAY, MIN, startOfDay } from "./time";

export interface FlightStats {
  /** Time in each state within the period (ms). */
  flyingMs: number;
  walkingMs: number;
  perchedMs: number;
  groundMs: number;
  /** Trips that started in the period. */
  flights: number;
  walks: number;
  /** Metres along the path, counting only the part inside the period. */
  flownM: number;
  walkedM: number;
  longestFlightM: number;
  longestFlightMs: number;
  /** Highest point reached (perched or in flight), metres. */
  maxHeightM: number;
  treesVisited: number;
  zonesVisited: number;
  /** Time covered by readings over the length of the period (0–1). */
  coverage: number;
  /** False for zone-only devices: no positions, so no distances or times can be worked out. */
  measurable: boolean;
}

/** Length of a trip as the map draws it: straight on the ground, with an arc in height when flown. */
function tripLength(a: Stay, b: Stay): number {
  if (isWalk(a, b)) return Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
  const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
  const lift = Math.min(5, d * 0.18);
  let len = 0;
  let prev = a.pos;
  for (let i = 1; i <= 16; i++) {
    const f = i / 16;
    const y = Math.min(FOOTPRINT.domeHeight - 1, a.pos.y + (b.pos.y - a.pos.y) * f + Math.sin(Math.PI * f) * lift);
    const p = { x: a.pos.x + (b.pos.x - a.pos.x) * f, y, z: a.pos.z + (b.pos.z - a.pos.z) * f };
    len += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    prev = p;
  }
  return len;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

export function flightStats(bird: MonitorBird, stays: Stay[], from: number, to: number): FlightStats {
  const end = Math.min(to, bird.signalLostAt ?? to);
  const s: FlightStats = {
    flyingMs: 0, walkingMs: 0, perchedMs: 0, groundMs: 0, flights: 0, walks: 0, flownM: 0, walkedM: 0,
    longestFlightM: 0, longestFlightMs: 0, maxHeightM: 0, treesVisited: 0, zonesVisited: 0, coverage: 0,
    measurable: bird.device.status !== "intermittent",
  };
  const trees = new Set<string>();
  const zones = new Set<string>();
  for (let i = 0; i < stays.length; i++) {
    const st = stays[i];
    if (st.start > end) break;
    const here = overlap(st.start, st.end, from, end);
    if (here > 0) {
      if (st.inCrown) s.perchedMs += here;
      else s.groundMs += here;
      trees.add(st.treeId);
      zones.add(st.zoneId);
      s.maxHeightM = Math.max(s.maxHeightM, st.pos.y);
    }
    const next = stays[i + 1];
    if (!next) continue;
    const trip = overlap(st.end, next.start, from, end);
    if (trip <= 0) continue;
    const share = trip / Math.max(1, next.start - st.end);
    const len = tripLength(st, next);
    const counts = st.end >= from;
    if (isWalk(st, next)) {
      s.walkingMs += trip;
      s.walkedM += len * share;
      if (counts) s.walks++;
    } else {
      s.flyingMs += trip;
      s.flownM += len * share;
      if (counts) {
        s.flights++;
        if (len > s.longestFlightM) {
          s.longestFlightM = len;
          s.longestFlightMs = next.start - st.end;
        }
      }
      const d = Math.hypot(st.pos.x - next.pos.x, st.pos.z - next.pos.z);
      s.maxHeightM = Math.max(s.maxHeightM, Math.min(FOOTPRINT.domeHeight - 1, Math.max(st.pos.y, next.pos.y) + Math.min(5, d * 0.18)));
    }
  }
  s.treesVisited = trees.size;
  s.zonesVisited = zones.size;
  const covered = s.flyingMs + s.walkingMs + s.perchedMs + s.groundMs;
  s.coverage = to > from ? Math.min(1, covered / (to - from)) : 0;
  return s;
}

/** Average flying speed, m/s; null without flights. */
export const flightSpeed = (s: FlightStats) => (s.flyingMs > 0 ? s.flownM / (s.flyingMs / 1000) : null);

/** Per-day figures, the unit used to compare against itself and its species. */
export interface DailyFlight {
  flyingMin: number;
  flownM: number;
  flights: number;
}

const perDay = (s: FlightStats, days: number): DailyFlight => ({ flyingMin: s.flyingMs / MIN / days, flownM: s.flownM / days, flights: s.flights / days });

/** Daily average of the species over the week before asOf (birds with positions only). */
export function speciesFlightBaseline(ds: TrackingDataset, speciesId: string, asOf: number): DailyFlight | null {
  const from = Math.max(ds.windowStart, asOf - 7 * DAY);
  const days = (asOf - from) / DAY;
  if (days < 1) return null;
  let n = 0;
  const sum: DailyFlight = { flyingMin: 0, flownM: 0, flights: 0 };
  for (const b of ds.registry.birds) {
    if (b.speciesId !== speciesId || b.device.status === "intermittent") continue;
    const s = flightStats(b, ds.stays.get(b.id) ?? [], from, asOf);
    if (s.coverage < 0.6) continue;
    const d = perDay(s, days * s.coverage);
    sum.flyingMin += d.flyingMin;
    sum.flownM += d.flownM;
    sum.flights += d.flights;
    n++;
  }
  return n ? { flyingMin: sum.flyingMin / n, flownM: sum.flownM / n, flights: sum.flights / n } : null;
}

/** Flying minutes and metres per calendar day, oldest first (today up to asOf). */
export function flightByDay(bird: MonitorBird, stays: Stay[], windowStart: number, asOf: number, days = 7) {
  const out: { day: number; flyingMin: number; flownM: number; flights: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d0 = startOfDay(asOf) - i * DAY;
    if (d0 + DAY <= windowStart) continue;
    const s = flightStats(bird, stays, Math.max(d0, windowStart), Math.min(d0 + DAY, asOf));
    out.push({ day: d0, flyingMin: s.flyingMs / MIN, flownM: s.flownM, flights: s.flights });
  }
  return out;
}

export interface BirdInsight {
  level: InsightLevel;
  headline: string;
  points: InsightPoint[];
  today: DailyFlight;
  /** Its own daily average over the days before the last 24 h. */
  before: DailyFlight | null;
  species: DailyFlight | null;
  coverage: number;
}

const fmtMin = (m: number) => (m >= 90 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);
export const fmtDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);

export function birdInsight(ds: TrackingDataset, bird: MonitorBird, asOf: number, species: DailyFlight | null): BirdInsight {
  const stays = ds.stays.get(bird.id) ?? [];
  const last = flightStats(bird, stays, asOf - DAY, asOf);
  const today = perDay(last, 1);
  const prevFrom = Math.max(ds.windowStart, asOf - 7 * DAY);
  const prevDays = (asOf - DAY - prevFrom) / DAY;
  const prevStats = prevDays >= 1 ? flightStats(bird, stays, prevFrom, asOf - DAY) : null;
  const before = prevStats && prevStats.coverage >= 0.6 ? perDay(prevStats, prevDays * prevStats.coverage) : null;
  const points: InsightPoint[] = [];

  if (!last.measurable) {
    return {
      level: "watch",
      headline: "Not enough data to judge",
      points: [{ level: "watch", text: "The device only reports the zone, so flight time and distances cannot be worked out. Check the tag." }],
      today, before, species, coverage: last.coverage,
    };
  }
  if (last.coverage < 0.6) {
    points.push({ level: "watch", text: `Readings cover only ${Math.round(last.coverage * 100)}% of the last 24 h: the figures may be incomplete.` });
  } else {
    // Flying varies a lot day to day: only clear outliers count.
    // "Review" requires being low against the species AND against its own previous days.
    const vsSpecies = species && species.flyingMin > 0 ? today.flyingMin / species.flyingMin : 1;
    const vsSelf = before && before.flyingMin > 2 ? today.flyingMin / before.flyingMin : 1;
    const sp = species ? fmtMin(species.flyingMin) : "—";
    const me = before ? fmtMin(before.flyingMin) : "—";
    if (last.flights === 0) {
      points.push({ level: "check", text: "No flights recorded in the last 24 h: it has only walked or stayed put." });
    } else if (vsSpecies < 0.35 && vsSelf < 0.5) {
      points.push({ level: "check", text: `Flew ${fmtMin(today.flyingMin)} in the last 24 h: less than half its previous days (${me}/day) and well below its species (${sp}/day).` });
    } else if (vsSpecies < 0.5 && vsSelf < 0.65) {
      points.push({ level: "watch", text: `Flew ${fmtMin(today.flyingMin)} in the last 24 h, below its species (${sp}/day) and its previous days (${me}/day).` });
    } else if (vsSelf < 0.45) {
      points.push({ level: "watch", text: `Less flying than usual: ${fmtMin(today.flyingMin)} in the last 24 h vs ${me}/day on its previous days.` });
    } else if (vsSpecies > 2.2) {
      points.push({ level: "watch", text: `Flew ${fmtMin(today.flyingMin)} in the last 24 h, more than twice its species (${sp}/day). Restless?` });
    }
  }

  const level: InsightLevel = points.some((x) => x.level === "check") ? "check" : points.some((x) => x.level === "watch") ? "watch" : "ok";
  if (level === "ok")
    points.unshift({ level: "ok", text: `Flight within the usual range: ${fmtMin(today.flyingMin)} in the air over ${last.flights} flights and ${fmtDistance(last.flownM)} in the last 24 h.` });
  const headline = level === "ok" ? "Flight typical for its species" : level === "watch" ? "Flight changed — worth watching" : "Flight pattern worth a keeper check";
  return { level, headline, points, today, before, species, coverage: last.coverage };
}
