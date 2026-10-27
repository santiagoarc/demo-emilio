import type { ReadingQuality, ReadingSource, RecordStatus } from "@/domain/types";

export const SOURCE_LABEL: Record<ReadingSource, string> = {
  uwb: "Red de localización en tierra (simulada)",
  acoustic: "Receptor acústico en agua (simulado)",
  rfid_gate: "Compuerta RFID (simulada)",
};

export const SOURCE_SHORT: Record<ReadingSource, string> = { uwb: "Tierra · UWB", acoustic: "Agua · acústico", rfid_gate: "Compuerta RFID" };

export const QUALITY_LABEL: Record<ReadingQuality, string> = { high: "Alta", medium: "Media", low: "Baja" };
export const QUALITY_TONE: Record<ReadingQuality, "ok" | "info" | "warn"> = { high: "ok", medium: "info", low: "warn" };

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = {
  active: "Registro activo",
  recent: "Alta reciente",
  incomplete: "Datos incompletos",
};
