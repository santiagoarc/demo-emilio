import { AVIARY_SPECIES, AVIARY_ZONES, type AviaryDataset, type Bird, type BirdObservation } from "@/domain/aviary";
import { DAY, startOfDay } from "./time";

/** Last logged sighting of a bird, if any. */
export function lastObservation(ds: AviaryDataset, birdId: string): BirdObservation | undefined {
  const list = ds.observations.get(birdId);
  return list?.[list.length - 1];
}

/** Whole days since the last sighting; null = never seen in the window. */
export function daysSinceSeen(ds: AviaryDataset, birdId: string): number | null {
  const last = lastObservation(ds, birdId);
  return last ? Math.floor((ds.now - last.at) / DAY) : null;
}

export interface ZoneMove {
  from: string;
  to: string;
  /** Sighting where the bird was first logged in the new zone. */
  at: number;
  /** Previous sighting, in the old zone. Movement happened somewhere in between. */
  prevAt: number;
}

/** Zone changes between consecutive sightings. Times are bounds, not the moment of the move. */
export function zoneMoves(list: BirdObservation[]): ZoneMove[] {
  const out: ZoneMove[] = [];
  for (let i = 1; i < list.length; i++) {
    if (list[i].zoneId !== list[i - 1].zoneId) out.push({ from: list[i - 1].zoneId, to: list[i].zoneId, at: list[i].at, prevAt: list[i - 1].at });
  }
  return out;
}

/** Birds per zone by last logged sighting (birds never seen are counted apart). */
export function birdsByLastZone(ds: AviaryDataset, birds: Bird[]) {
  const counts = new Map<string, number>(AVIARY_ZONES.map((z) => [z.id, 0]));
  let unseen = 0;
  for (const b of birds) {
    const last = lastObservation(ds, b.id);
    if (!last) unseen++;
    else counts.set(last.zoneId, (counts.get(last.zoneId) ?? 0) + 1);
  }
  return { counts, unseen };
}

export function birdsBySpecies(birds: Bird[]) {
  return AVIARY_SPECIES.map((s) => ({ species: s, count: birds.filter((b) => b.speciesId === s.id).length }));
}

/** Sightings logged per day in the window (activity of the logbook, not of the birds). */
export function sightingsPerDay(ds: AviaryDataset, birds: Bird[]) {
  const days: { day: number; sightings: number; birds: number }[] = [];
  for (let d = startOfDay(ds.windowStart); d <= ds.now; d += DAY) days.push({ day: d, sightings: 0, birds: 0 });
  for (const b of birds) {
    const seenOn = new Set<number>();
    for (const o of ds.observations.get(b.id) ?? []) {
      const idx = Math.floor((startOfDay(o.at) - startOfDay(ds.windowStart)) / DAY);
      if (!days[idx]) continue;
      days[idx].sightings++;
      seenOn.add(idx);
    }
    for (const i of seenOn) days[i].birds++;
  }
  return days;
}

/** Search by ID, band, name or species name. */
export function matchBird(b: Bird, speciesName: string, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [b.id, b.bandId, b.name ?? "", speciesName].some((v) => v.toLowerCase().includes(s));
}

/* ───────────── UI helpers (English formatting, rule previews) ───────────── */

const enDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const enDayLong = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const enTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

/** "27 Oct". */
export const fmtAvDay = (ts: number) => enDay.format(ts);
/** "Tue, 27 Oct 2026". */
export const fmtAvDayLong = (ts: number) => enDayLong.format(ts);
/** "27 Oct, 14:05". */
export const fmtAvDateTime = (ts: number) => `${enDay.format(ts)}, ${enTime.format(ts)}`;
export const fmtAvTime = (ts: number) => enTime.format(ts);

/** "< 1 day ago", "1 day ago", "4 days ago"; null = no sighting in the window. */
export function daysAgoLabel(days: number | null, windowDays: number) {
  if (days === null) return `Not logged in ${windowDays} days`;
  if (days < 1) return "< 1 day ago";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export interface BirdRow {
  bird: Bird;
  last?: BirdObservation;
  /** Whole days since the last sighting; null = never seen in the window. */
  days: number | null;
}

export function birdRows(ds: AviaryDataset, birds: Bird[]): BirdRow[] {
  return birds.map((bird) => ({ bird, last: lastObservation(ds, bird.id), days: daysSinceSeen(ds, bird.id) }));
}

/** Birds whose last logged sighting is at least `minDays` old (or that have none in the window). */
export function notObservedFor(ds: AviaryDataset, birds: Bird[], minDays: number): BirdRow[] {
  return birdRows(ds, birds)
    .filter((r) => r.days === null || r.days >= minDays)
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity) || a.bird.id.localeCompare(b.bird.id));
}

/**
 * Days a bird has been logged only in off-exhibit areas (holding / care), counted from
 * the first sighting of its latest off-exhibit run. null = last sighting is on exhibit.
 */
export function offExhibitDays(ds: AviaryDataset, birdId: string): { days: number; zoneId: string; since: number } | null {
  const list = ds.observations.get(birdId) ?? [];
  if (!list.length) return null;
  const off = new Set(AVIARY_ZONES.filter((z) => z.offExhibit).map((z) => z.id));
  let i = list.length - 1;
  if (!off.has(list[i].zoneId)) return null;
  while (i > 0 && off.has(list[i - 1].zoneId)) i--;
  return { days: Math.floor((ds.now - list[i].at) / DAY), zoneId: list[list.length - 1].zoneId, since: list[i].at };
}

/** Sightings logged per zone in the last 24 h vs the zone's usual daily count in the rest of the window. */
export function zoneLogbookActivity(ds: AviaryDataset) {
  const recentFrom = ds.now - DAY;
  const priorDays = Math.max(1, (recentFrom - ds.windowStart) / DAY);
  const recent = new Map<string, number>(AVIARY_ZONES.map((z) => [z.id, 0]));
  const prior = new Map<string, number>(AVIARY_ZONES.map((z) => [z.id, 0]));
  for (const list of ds.observations.values()) {
    for (const o of list) {
      const m = o.at > recentFrom ? recent : prior;
      m.set(o.zoneId, (m.get(o.zoneId) ?? 0) + 1);
    }
  }
  return AVIARY_ZONES.map((z) => ({ zone: z, last24h: recent.get(z.id) ?? 0, usualPerDay: (prior.get(z.id) ?? 0) / priorDays }));
}

/** Days since the last headcount entry logged for any bird of each species group. */
export function headcountAgeBySpecies(ds: AviaryDataset) {
  return AVIARY_SPECIES.map((s) => {
    let lastAt = 0;
    for (const b of ds.birds) {
      if (b.speciesId !== s.id) continue;
      for (const o of ds.observations.get(b.id) ?? []) if (o.kind === "headcount" && o.at > lastAt) lastAt = o.at;
    }
    return { species: s, lastAt: lastAt || null, days: lastAt ? Math.floor((ds.now - lastAt) / DAY) : null };
  });
}

/** Birds per responsible team. */
export function birdsByTeam(birds: Bird[], teamIds: string[]) {
  return teamIds.map((id) => ({ teamId: id, count: birds.filter((b) => b.teamId === id).length }));
}

/** Sightings per day for one bird (for small charts). */
export function birdSightingsPerDay(ds: AviaryDataset, birdId: string) {
  const days: { day: number; sightings: number }[] = [];
  for (let d = startOfDay(ds.windowStart); d <= ds.now; d += DAY) days.push({ day: d, sightings: 0 });
  for (const o of ds.observations.get(birdId) ?? []) {
    const idx = Math.floor((startOfDay(o.at) - startOfDay(ds.windowStart)) / DAY);
    if (days[idx]) days[idx].sightings++;
  }
  return days;
}
