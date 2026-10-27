import type { RulesConfig } from "@/config/demo.config";
import type { Dataset, LocationReading, Penguin, TrackingDevice } from "@/domain/types";
import { MIN } from "./time";

export type LiveStatus = "water" | "land" | "resting" | "stale" | "offline" | "no_data";

export const STATUS_LABEL: Record<LiveStatus, string> = {
  water: "In water",
  land: "On land",
  resting: "No movement recorded",
  stale: "Location not current",
  offline: "Last known location",
  no_data: "No data",
};

export const STATUS_HINT: Record<LiveStatus, string> = {
  water: "The latest reading indicates the bird is in the water.",
  land: "The latest reading is on land, with movement.",
  resting: "Recent readings at the same position. This says nothing about movement between readings.",
  stale: "No recent position. Showing the last known location and its reading time.",
  offline: "No recent readings. Showing the last known location and its reading time.",
  no_data: "No readings for this penguin in the selected period.",
};

export interface Snapshot {
  penguin: Penguin;
  device: TrackingDevice;
  reading?: LocationReading;
  ageMin: number;
  status: LiveStatus;
  recent: boolean;
}

/** Index of the last reading with timestamp ≤ t (or -1). */
export function lastIndexAtOrBefore(list: LocationReading[], t: number): number {
  let lo = 0, hi = list.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].timestamp <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function firstIndexAtOrAfter(list: { timestamp: number }[], t: number): number {
  let lo = 0, hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].timestamp < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function snapshotAt(ds: Dataset, deviceById: Map<string, TrackingDevice>, rules: RulesConfig, p: Penguin, at: number): Snapshot {
  const list = ds.readings.get(p.id) ?? [];
  const idx = lastIndexAtOrBefore(list, at);
  const device = deviceById.get(p.deviceId)!;
  const reading = idx >= 0 ? list[idx] : undefined;
  const ageMin = reading ? (at - reading.timestamp) / MIN : Infinity;
  const recent = ageMin <= rules.recentLocationMinutes;
  let status: LiveStatus;
  if (!reading) status = "no_data";
  else if (device.profile === "offline" && at > device.lastHeartbeat) status = at - device.lastHeartbeat > rules.deviceOfflineMinutes * MIN ? "offline" : "stale";
  else if (!recent) status = "stale";
  else if (reading.medium === "water") status = "water";
  else {
    const prev = idx > 0 ? list[idx - 1] : undefined;
    status = prev && prev.x === reading.x && prev.y === reading.y && reading.timestamp - prev.timestamp <= ds.slotMinutes * MIN ? "resting" : "land";
  }
  return { penguin: p, device, reading, ageMin, status, recent };
}
