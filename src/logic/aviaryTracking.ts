import {
  levelOf,
  type Detection,
  type FixStatus,
  type LevelId,
  type LocationKind,
  type MonitorBird,
  type Stay,
  type TrackingDataset,
  type TrackingSource,
} from "@/domain/aviaryTracking";
import { HOUR, MIN } from "@/logic/time";

export const FRESH_MS = 10 * MIN;
export const STALE_MS = 6 * HOUR;

export interface Fix {
  bird: MonitorBird;
  det: Detection | null;
  status: FixStatus;
  /** Null when there is no height (zone-only or no location). */
  levelId: LevelId | null;
}

export function fixStatus(det: Detection | null, asOf: number): FixStatus {
  if (!det) return "no-signal";
  const age = asOf - det.at;
  if (age <= FRESH_MS) return det.moving ? "moving" : "detected";
  if (age <= STALE_MS) return "stale";
  return "no-signal";
}

/** Latest detection of every bird as of a moment. */
export function snapshot(ds: TrackingDataset, src: TrackingSource, asOf: number): Map<string, Fix> {
  const out = new Map<string, Fix>();
  for (const bird of ds.registry.birds) {
    const det = src.latest(bird.id, asOf);
    out.set(bird.id, { bird, det, status: fixStatus(det, asOf), levelId: det?.pos ? levelOf(det.pos.y).id : null });
  }
  return out;
}

/** Data quality, from the kind of location and how old it is. */
export function dataQuality(fix: Fix): { label: string; tone: "ok" | "info" | "warn" | "danger" | "neutral" } {
  const d = fix.det;
  if (!d) return { label: "No data", tone: "neutral" };
  if (fix.status === "no-signal") return { label: "Low · no recent signal", tone: "danger" };
  if (fix.status === "stale") return { label: "Low · old location", tone: "warn" };
  if (d.kind === "zone") return { label: "Medium · zone level only", tone: "info" };
  if ((d.precisionM ?? 99) <= 1.5) return { label: "High", tone: "ok" };
  return { label: "Medium · wide uncertainty", tone: "info" };
}

/** One row of location history, showing only what the device can tell. */
export interface HistoryRow {
  id: string;
  start: number;
  end: number;
  zoneId: string;
  treeId: string | null;
  heightM: number | null;
  kind: LocationKind;
}

export function historyRows(bird: MonitorBird, stays: Stay[], asOf: number): HistoryRow[] {
  const zoneOnly = bird.device.status === "intermittent";
  return stays
    .filter((s) => s.start <= asOf)
    .map((s) => ({
      id: s.id,
      start: s.start,
      end: Math.min(s.end, asOf, bird.signalLostAt ?? Infinity),
      zoneId: s.zoneId,
      treeId: zoneOnly ? null : s.treeId,
      heightM: zoneOnly ? null : s.pos.y,
      kind: zoneOnly ? ("zone" as const) : ("computed-3d" as const),
    }))
    .reverse();
}

/** Birds whose latest detection places them in (or under) a tree. */
export function treeOccupants(fixes: Map<string, Fix>, treeId: string): Fix[] {
  return [...fixes.values()].filter((f) => f.det?.treeId === treeId).sort((a, b) => (b.det!.pos?.y ?? 0) - (a.det!.pos?.y ?? 0));
}

/** Stays at a tree over a period. Zone-only devices are left out: they cannot place a bird in a tree. */
export function treeHistory(ds: TrackingDataset, src: TrackingSource, treeId: string, from: number, to: number) {
  const rows: { id: string; birdId: string; start: number; end: number; heightM: number }[] = [];
  for (const bird of ds.registry.birds) {
    if (bird.device.status === "intermittent") continue;
    for (const s of src.history(bird.id, from, to)) if (s.treeId === treeId && s.start <= to) rows.push({ id: s.id, birdId: bird.id, start: s.start, end: Math.min(s.end, to), heightM: s.pos.y });
  }
  return rows.sort((a, b) => b.start - a.start);
}

/** Arrivals at a new tree in the period before asOf: the movement feed. */
export function recentMoves(ds: TrackingDataset, asOf: number, windowMs: number, limit = 12) {
  const out: { id: string; birdId: string; at: number; fromTreeId: string | null; toTreeId: string; zoneId: string; heightM: number }[] = [];
  for (const bird of ds.registry.birds) {
    if (bird.signalLostAt && bird.signalLostAt < asOf) continue;
    const list = ds.stays.get(bird.id) ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.start > asOf) continue;
      if (s.start < asOf - windowMs) break;
      if (i > 0 && list[i - 1].treeId === s.treeId) continue;
      out.push({ id: s.id, birdId: bird.id, at: s.start, fromTreeId: i > 0 ? list[i - 1].treeId : null, toTreeId: s.treeId, zoneId: s.zoneId, heightM: s.pos.y });
    }
  }
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** Per hour over the 24 h before asOf: birds with a detection, and birds that moved. */
export function activityByHour(ds: TrackingDataset, src: TrackingSource, asOf: number) {
  const start = Math.floor((asOf - 24 * HOUR) / HOUR) * HOUR + HOUR;
  const buckets = Array.from({ length: 24 }, (_, i) => ({ at: start + i * HOUR, detected: 0, moving: 0 }));
  for (const bird of ds.registry.birds) {
    const stays = src.history(bird.id, start, asOf);
    const seen = new Set<number>();
    const moved = new Set<number>();
    for (const s of stays) {
      const a = Math.max(0, Math.floor((s.start - start) / HOUR));
      const b = Math.min(23, Math.floor((Math.min(s.end, asOf, bird.signalLostAt ?? asOf) - start) / HOUR));
      for (let h = a; h <= b; h++) seen.add(h);
      const tr = Math.floor((s.end - start) / HOUR);
      if (s.end < asOf && tr >= 0 && tr < 24) moved.add(tr);
    }
    seen.forEach((h) => buckets[h].detected++);
    moved.forEach((h) => buckets[h].moving++);
  }
  return buckets;
}

export function fmtHeight(m: number | null | undefined) {
  return m == null ? "—" : `${m.toFixed(1)} m`;
}
