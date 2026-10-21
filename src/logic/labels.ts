import type { AlertPriority, AlertStatus, ReadingQuality, ReadingSource, RecordStatus, TaskKind, TaskStatus } from "@/domain/types";

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

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { pending: "Pendiente", in_progress: "En proceso", done: "Completada", cancelled: "Cancelada" };
export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  routine_review: "Revisión de rutina",
  device_check: "Revisión de dispositivo",
  weighing: "Pesaje",
  zone_maintenance: "Mantenimiento de zona",
  observation_followup: "Seguimiento de observación",
};

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = { pending: "Pendiente", following: "En seguimiento", resolved: "Resuelta" };
export const PRIORITY_LABEL: Record<AlertPriority, string> = { high: "Alta", medium: "Media", low: "Baja" };
export const PRIORITY_TONE: Record<AlertPriority, "danger" | "warn" | "neutral"> = { high: "danger", medium: "warn", low: "neutral" };
