import type { RulesConfig } from "@/config/demo.config";
import type { Dataset, LocationReading, Penguin, TrackingDevice } from "@/domain/types";
import { MIN } from "./time";

export type LiveStatus = "water" | "land" | "resting" | "stale" | "offline" | "no_data";

export const STATUS_LABEL: Record<LiveStatus, string> = {
  water: "En agua",
  land: "En tierra",
  resting: "Sin movimiento registrado",
  stale: "Ubicación desactualizada",
  offline: "Sin comunicación",
  no_data: "Sin datos",
};

export const STATUS_HINT: Record<LiveStatus, string> = {
  water: "Última lectura reciente indica inmersión.",
  land: "Última lectura reciente en tierra con desplazamiento.",
  resting: "Lecturas recientes en la misma posición. No implica inmovilidad fuera de las lecturas.",
  stale: "El dispositivo comunica pero no hay posición reciente. Se muestra la última conocida.",
  offline: "El dispositivo no comunica. Se muestra la última ubicación conocida.",
  no_data: "No hay lecturas para este ejemplar en el periodo.",
};

export interface Snapshot {
  penguin: Penguin;
  device: TrackingDevice;
  reading?: LocationReading;
  ageMin: number;
  status: LiveStatus;
  recent: boolean;
}

/** Índice de la última lectura con timestamp ≤ t (o -1). */
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
