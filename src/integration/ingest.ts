/**
 * Capa de integración futura — SOLO CONTRATOS, sin conexión a nada.
 *
 * Ningún dispositivo, proveedor ni API está conectado en esta fase. Este
 * archivo define cómo debería entrar una lectura real para que el resto de la
 * plataforma la consuma igual que hoy consume las simuladas.
 *
 * Supuestos de diseño (a validar con proveedor y en el hábitat real):
 * - Un GPS convencional no da posición útil bajo el agua ni bajo techo. En
 *   tierra se contempla una red local (p. ej. UWB o similar) y en agua
 *   receptores acústicos con precisión de zona, no de punto.
 * - El medio (agua/tierra) se infiere mejor con un sensor de inmersión
 *   (wet/dry o presión) que con la posición.
 * - Las compuertas RFID solo confirman paso por un punto conocido.
 * - Sin cámaras ni reconocimiento visual en esta fase.
 */
import type { LocationReading, Medium, ReadingQuality, ReadingSource } from "@/domain/types";

/** Lectura tal como llegaría de cualquier proveedor, antes de normalizar. */
export interface RawReading {
  deviceId: string;
  /** ISO 8601 o epoch ms. */
  timestamp: string | number;
  source: ReadingSource;
  /** Posición en coordenadas del plano, si la fuente la da. */
  position?: { x: number; y: number; accuracyM?: number };
  /** Zona reportada (receptores acústicos y compuertas suelen dar solo esto). */
  zoneId?: string;
  /** Lectura del sensor de inmersión, si existe. */
  immersed?: boolean;
  /** Calidad reportada por el proveedor en su propia escala, 0–1. */
  confidence?: number;
}

export interface DeviceHeartbeat {
  deviceId: string;
  timestamp: string | number;
  batteryPct?: number;
}

/** Contrato que implementaría cada proveedor. Hoy no hay ninguna implementación. */
export interface ReadingAdapter {
  readonly source: ReadingSource;
  /** Entrega lecturas nuevas desde `since`. */
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

/** Convierte una lectura cruda al modelo de la plataforma, o explica por qué no. */
export function normalizeReading(raw: RawReading, ctx: NormalizeContext): NormalizeResult {
  const penguinId = ctx.penguinIdForDevice(raw.deviceId);
  if (!penguinId) return { ok: false, reason: `Dispositivo ${raw.deviceId} sin ejemplar asociado.` };
  const timestamp = typeof raw.timestamp === "number" ? raw.timestamp : Date.parse(raw.timestamp);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: "Fecha inválida." };

  const zoneId = raw.zoneId ?? (raw.position ? ctx.zoneAt(raw.position.x, raw.position.y) : undefined);
  if (!zoneId) return { ok: false, reason: "Lectura sin zona ni posición utilizable." };

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
