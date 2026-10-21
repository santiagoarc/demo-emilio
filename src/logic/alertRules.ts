/**
 * Reglas de alerta: explícitas, configurables y operativas.
 *
 * Ninguna regla diagnostica ni infiere estados de salud. Una desviación de
 * actividad no genera alertas por sí misma; solo hechos operativos:
 * lecturas que no llegan, dispositivos que no comunican, revisiones y tareas
 * vencidas, y marcas puestas por personas del equipo.
 */
import type { AlertRulesConfig } from "@/config/demo.config";
import type { Alert, CareTask, Dataset } from "@/domain/types";
import { lastIndexAtOrBefore } from "./status";
import { DAY, HOUR, MIN, fmtAgo } from "./time";

export const ALERT_TYPE_LABEL: Record<Alert["type"], string> = {
  stale_location: "Lectura desactualizada",
  device_offline: "Dispositivo sin comunicación",
  care_review_pending: "Revisión de cuidado pendiente",
  task_overdue: "Tarea vencida",
  team_review_requested: "Revisión solicitada por el equipo",
};

export function describeRules(r: AlertRulesConfig): Record<Alert["type"], string> {
  return {
    stale_location: `El dispositivo comunica pero la última posición tiene más de ${r.staleLocationMinutes} min. Alta si supera 4 h.`,
    device_offline: `Sin latido del dispositivo por más de ${Math.round(r.deviceOfflineMinutes / 60)} h. Siempre alta.`,
    care_review_pending: `Más de ${r.careReviewIntervalDays} días desde la última revisión de rutina. Alta si el atraso supera ${r.careReviewHighAfterDays} días.`,
    task_overdue: `Tarea abierta con fecha límite vencida (excepto revisiones de rutina, que cubre su propia regla). Alta tras ${r.taskOverdueHighAfterHours} h.`,
    team_review_requested: "Una persona del equipo marcó al ejemplar para revisión. No es un diagnóstico.",
  };
}

export function evaluateAlertRules(ds: Dataset, tasks: CareTask[], teamOf: (penguinId: string) => string, r: AlertRulesConfig): Alert[] {
  const now = ds.now;
  const out: Alert[] = [];
  const rules = describeRules(r);
  const mk = (a: Omit<Alert, "status" | "history" | "rule">): Alert => ({
    ...a,
    rule: rules[a.type],
    status: "pending",
    history: [{ at: a.createdAt, by: "Motor de reglas", text: "Alerta generada." }],
  });

  for (const d of ds.devices) {
    const p = ds.penguins.find((x) => x.id === d.penguinId)!;
    const silent = now - d.lastHeartbeat;
    if (silent > r.deviceOfflineMinutes * MIN) {
      out.push(mk({
        id: `ALR-offline-${p.id}`,
        type: "device_offline",
        priority: "high",
        penguinId: p.id,
        teamId: teamOf(p.id),
        createdAt: d.lastHeartbeat + r.deviceOfflineMinutes * MIN,
        description: `${d.id} no comunica desde ${fmtAgo(d.lastHeartbeat, now)}. Se conserva la última ubicación conocida.`,
      }));
      continue;
    }
    const list = ds.readings.get(p.id) ?? [];
    const last = list[lastIndexAtOrBefore(list, now)];
    if (last && now - last.timestamp > r.staleLocationMinutes * MIN) {
      const age = now - last.timestamp;
      out.push(mk({
        id: `ALR-stale-${p.id}`,
        type: "stale_location",
        priority: age > 4 * HOUR ? "high" : "medium",
        penguinId: p.id,
        teamId: teamOf(p.id),
        createdAt: last.timestamp + r.staleLocationMinutes * MIN,
        description: `El dispositivo comunica, pero la última posición es de ${fmtAgo(last.timestamp, now)}. No se asume que el ejemplar esté inmóvil.`,
      }));
    }
  }

  for (const p of ds.penguins) {
    const due = p.lastReviewAt + r.careReviewIntervalDays * DAY;
    if (due < now) {
      const late = (now - due) / DAY;
      out.push(mk({
        id: `ALR-review-${p.id}`,
        type: "care_review_pending",
        priority: late > r.careReviewHighAfterDays ? "high" : "medium",
        penguinId: p.id,
        teamId: teamOf(p.id),
        createdAt: due,
        description: `Revisión de rutina vencida hace ${Math.max(1, Math.round(late))} día(s).`,
      }));
    }
  }

  for (const t of tasks) {
    if (t.status === "done" || t.status === "cancelled" || t.kind === "routine_review" || t.dueAt >= now) continue;
    out.push(mk({
      id: `ALR-task-${t.id}`,
      type: "task_overdue",
      priority: now - t.dueAt > r.taskOverdueHighAfterHours * HOUR ? "high" : "medium",
      penguinId: t.penguinId,
      taskId: t.id,
      teamId: t.teamId,
      createdAt: t.dueAt,
      description: `"${t.title}" venció ${fmtAgo(t.dueAt, now)}.`,
    }));
  }

  for (const f of ds.reviewFlags) {
    out.push(mk({
      id: `ALR-flag-${f.penguinId}`,
      type: "team_review_requested",
      priority: "low",
      penguinId: f.penguinId,
      teamId: teamOf(f.penguinId),
      createdAt: f.at,
      description: `Registro ficticio: ${f.by} marcó al ejemplar para una revisión adicional.`,
    }));
  }

  return out.sort((a, b) => b.createdAt - a.createdAt);
}
