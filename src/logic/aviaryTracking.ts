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
  for (const bird of ds.birds) {
    const det = src.latest(bird.id, asOf);
    out.set(bird.id, { bird, det, status: fixStatus(det, asOf), levelId: det?.pos ? levelOf(det.pos.y).id : null });
  }
  return out;
}

export function locationKind(fix: Fix): LocationKind {
  return fix.det?.kind ?? "unknown";
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

/** One row of location history, showing only what the method can tell. */
export interface HistoryRow {
  start: number;
  end: number;
  zoneId: string;
  treeId: string | null;
  heightM: number | null;
  kind: LocationKind;
}

export function historyRows(bird: MonitorBird, stays: Stay[]): HistoryRow[] {
  return stays
    .map((s) => {
      const end = Math.min(s.end, bird.signalLostAt ?? s.end);
      if (bird.method === "tag-zone") return { start: s.start, end, zoneId: s.zoneId, treeId: null, heightM: null, kind: "zone" as const };
      if (bird.method === "visual") return { start: s.start, end, zoneId: s.zoneId, treeId: s.treeId, heightM: s.pos.y, kind: "confirmed" as const };
      return { start: s.start, end, zoneId: s.zoneId, treeId: s.treeId, heightM: s.pos.y, kind: "computed-3d" as const };
    })
    .reverse();
}

/** Birds whose latest detection places them in a tree. */
export function treeOccupants(fixes: Map<string, Fix>, treeId: string): Fix[] {
  return [...fixes.values()].filter((f) => f.det?.treeId === treeId).sort((a, b) => (b.det!.pos?.y ?? 0) - (a.det!.pos?.y ?? 0));
}

/** Detections associated with a tree over a period (3D-located or visually confirmed birds only). */
export function treeHistory(ds: TrackingDataset, src: TrackingSource, treeId: string, from: number, to: number) {
  const rows: { birdId: string; start: number; end: number; heightM: number }[] = [];
  for (const bird of ds.birds) {
    if (bird.method !== "tag-3d" && bird.method !== "visual") continue;
    for (const s of src.history(bird.id, from, to)) if (s.treeId === treeId) rows.push({ birdId: bird.id, start: s.start, end: Math.min(s.end, to), heightM: s.pos.y });
  }
  return rows.sort((a, b) => b.start - a.start);
}

/** Per hour over the 24 h before asOf: birds with a detection, and birds that moved. */
export function activityByHour(ds: TrackingDataset, src: TrackingSource, asOf: number) {
  const start = Math.floor((asOf - 24 * HOUR) / HOUR) * HOUR + HOUR;
  const buckets = Array.from({ length: 24 }, (_, i) => ({ at: start + i * HOUR, detected: 0, moving: 0 }));
  for (const bird of ds.birds) {
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
    if (bird.method !== "visual") moved.forEach((h) => buckets[h].moving++);
  }
  return buckets;
}

export function fmtHeight(m: number | null | undefined) {
  return m == null ? "—" : `${m.toFixed(1)} m`;
}
