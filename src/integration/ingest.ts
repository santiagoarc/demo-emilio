/**
 * Future integration layer — CONTRACTS ONLY, not connected to anything.
 *
 * No device, vendor or API is connected in this phase. This file defines how
 * a real reading should come in so the rest of the platform consumes it the
 * same way it consumes simulated ones today.
 *
 * Design assumptions (to validate with a vendor and in the real habitat):
 * - Conventional GPS gives no useful position underwater or indoors. On land
 *   a local network is assumed (e.g. UWB or similar), and in water acoustic
 *   receivers with zone-level, not point-level, accuracy.
 * - Medium (water/land) is better inferred from an immersion sensor
 *   (wet/dry or pressure) than from position.
 * - RFID gates only confirm passage through a known point.
 * - No cameras or visual recognition in this phase.
 */
import type { LocationReading, Medium, ReadingQuality, ReadingSource } from "@/domain/types";

/** A reading as it would arrive from any vendor, before normalization. */
export interface RawReading {
  deviceId: string;
  /** ISO 8601 or epoch ms. */
  timestamp: string | number;
  source: ReadingSource;
  /** Position in layout coordinates, if the source provides one. */
  position?: { x: number; y: number; accuracyM?: number };
  /** Reported zone (acoustic receivers and gates usually provide only this). */
  zoneId?: string;
  /** Immersion sensor reading, if any. */
  immersed?: boolean;
  /** Vendor-reported quality on its own scale, 0–1. */
  confidence?: number;
}

export interface DeviceHeartbeat {
  deviceId: string;
  timestamp: string | number;
  batteryPct?: number;
}

/** Contract each vendor would implement. No implementation exists today. */
export interface ReadingAdapter {
  readonly source: ReadingSource;
  /** Returns new readings since `since`. */
  poll(since: number): Promise<RawReading[]>;
  heartbeats?(since: number): Promise<DeviceHeartbeat[]>;
}

export interface NormalizeContext {
  penguinIdForDevice: (deviceId: string) => string | undefined;
  zoneAt: (x: number, y: number) => string | undefined;
  zoneMedium: (zoneId: string) => Medium | undefined;
}

export type NormalizeResult =
  | { ok: true; reading: Omit<LocationReading, "simulated"> & { simulated: false } }
  | { ok: false; reason: string };

/** Converts a raw reading to the platform model, or explains why it can't. */
export function normalizeReading(raw: RawReading, ctx: NormalizeContext): NormalizeResult {
  const penguinId = ctx.penguinIdForDevice(raw.deviceId);
  if (!penguinId) return { ok: false, reason: `Device ${raw.deviceId} has no associated penguin.` };
  const timestamp = typeof raw.timestamp === "number" ? raw.timestamp : Date.parse(raw.timestamp);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: "Invalid timestamp." };

  const zoneId = raw.zoneId ?? (raw.position ? ctx.zoneAt(raw.position.x, raw.position.y) : undefined);
  if (!zoneId) return { ok: false, reason: "Reading has no usable zone or position." };

  const medium: Medium = raw.immersed === undefined ? ctx.zoneMedium(zoneId) ?? "land" : raw.immersed ? "water" : "land";
  const c = raw.confidence;
  const quality: ReadingQuality = c === undefined ? "medium" : c >= 0.8 ? "high" : c >= 0.5 ? "medium" : "low";

  return {
    ok: true,
    reading: {
      penguinId,
      deviceId: raw.deviceId,
      timestamp,
      zoneId,
      x: raw.position?.x ?? NaN,
      y: raw.position?.y ?? NaN,
      accuracyM: raw.position?.accuracyM ?? NaN,
      source: raw.source,
      quality,
      medium,
      simulated: false,
    },
  };
}
