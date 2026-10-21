import type { AlertType, CareTask } from "@/domain/types";
import { DAY } from "./time";

/** Una tarea sigue abierta mientras no esté completada ni cancelada. */
export const isOpenTask = (t: Pick<CareTask, "status">) => t.status === "pending" || t.status === "in_progress";

export type TaskPriority = "high" | "medium" | "low";

/**
 * Las tareas no traen prioridad propia: se deriva del vencimiento
 * (vencida → alta, vence en 24 h → media, después → baja).
 */
export function taskPriority(t: CareTask, now: number): TaskPriority {
  if (!isOpenTask(t)) return "low";
  if (t.dueAt < now) return "high";
  if (t.dueAt < now + DAY) return "medium";
  return "low";
}

/** Momento de la última actualización registrada de una tarea. */
export const taskUpdatedAt = (t: CareTask) => t.history[t.history.length - 1]?.at ?? t.createdAt;

/** Familia de una alerta, para distinguir conectividad, ubicación, tareas e incidencias operativas. */
export type AlertFamily = "connectivity" | "location" | "task" | "operational";
export const ALERT_FAMILY: Record<AlertType, AlertFamily> = {
  device_offline: "connectivity",
  stale_location: "location",
  task_overdue: "task",
  care_review_pending: "operational",
  team_review_requested: "operational",
};
export const ALERT_FAMILY_LABEL: Record<AlertFamily, string> = {
  connectivity: "Conectividad",
  location: "Ubicación desactualizada",
  task: "Tarea vencida",
  operational: "Incidencia operativa",
};

/**
 * Cumplimiento: de las tareas que vencían dentro del periodo (sin canceladas),
 * cuántas están completadas. No mezcla pendientes futuras con históricas.
 */
export function taskCompliance(tasks: CareTask[], from: number, to: number, now: number) {
  const due = tasks.filter((t) => t.status !== "cancelled" && t.dueAt >= from && t.dueAt < Math.min(to, now));
  const done = due.filter((t) => t.status === "done").length;
  return { done, total: due.length, pct: due.length ? Math.round((done / due.length) * 100) : null };
}
