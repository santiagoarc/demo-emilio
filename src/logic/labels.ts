import type { ReadingQuality, ReadingSource, RecordStatus } from "@/domain/types";

export const SOURCE_LABEL: Record<ReadingSource, string> = {
  uwb: "Land positioning network",
  acoustic: "Underwater acoustic receiver",
  rfid_gate: "RFID gate",
};

export const SOURCE_SHORT: Record<ReadingSource, string> = { uwb: "Land · UWB", acoustic: "Water · acoustic", rfid_gate: "RFID gate" };

export const QUALITY_LABEL: Record<ReadingQuality, string> = { high: "High", medium: "Medium", low: "Low" };
export const QUALITY_TONE: Record<ReadingQuality, "ok" | "info" | "warn"> = { high: "ok", medium: "info", low: "warn" };

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = {
  active: "Active record",
  recent: "Recently admitted",
  incomplete: "Incomplete record",
};
