"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowUpRight, BellRing, CheckCircle2, Eye, ListChecks, MapPinned, Plus, RotateCcw, ScrollText } from "lucide-react";
import { ZONE_BY_ID, PENGUIN_ZONES } from "@/domain/habitat";
import type { AlertPriority, AlertStatus, AlertType, CareTask, TaskKind, TaskStatus } from "@/domain/types";
import { ALERT_TYPE_LABEL, describeRules } from "@/logic/alertRules";
import { ALERT_STATUS_LABEL, PRIORITY_LABEL, PRIORITY_TONE, TASK_KIND_LABEL, TASK_STATUS_LABEL } from "@/logic/labels";
import { DAY, fmtAgo, fmtDateTime, HOUR } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, Button, Drawer, EmptyState, Segmented, Select, cx } from "@/components/ui/primitives";
import { TaskStatusControl } from "./TaskStatusControl";
import { isOpenTask } from "@/logic/tasks";

type Tab = "alerts" | "tasks";
type StatusView = "open" | AlertStatus | "all";
const PRIORITY_ORDER: AlertPriority[] = ["high", "medium", "low"];

export function AlertsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { alerts, tasks, now } = useDemo();
  const tab: Tab = params.get("tab") === "tasks" ? "tasks" : "alerts";
  const alertId = params.get("alert");
  const taskId = params.get("task");
  const [creating, setCreating] = useState(false);

  const setParam = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  const open = alerts.filter((a) => a.status !== "resolved");
  const openTasks = tasks.filter((t) => isOpenTask(t));
  const overdue = openTasks.filter((t) => t.dueAt < now);

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Operación"
        title="Alerts & Tasks"
        subtitle="Alertas operativas generadas por reglas explícitas y tareas de los equipos. Ninguna regla diagnostica estados de salud."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> Nueva tarea
          </Button>
        }
      />
      <div className="space-y-5 px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Summary label="Alertas pendientes" value={alerts.filter((a) => a.status === "pending").length} tone="var(--warn)" />
          <Summary label="En seguimiento" value={alerts.filter((a) => a.status === "following").length} tone="var(--accent-2)" />
          <Summary label="Prioridad alta abiertas" value={open.filter((a) => a.priority === "high").length} tone="var(--danger)" />
          <Summary label="Tareas abiertas" value={openTasks.length} tone="var(--ice)" />
          <Summary label="Tareas vencidas" value={overdue.length} tone="var(--danger)" />
        </div>

        <div className="flex items-center gap-2">
          <Segmented<Tab>
            value={tab}
            onChange={(v) => setParam({ tab: v === "tasks" ? "tasks" : null })}
            options={[
              { value: "alerts", label: <span className="inline-flex items-center gap-1.5"><BellRing size={13} /> Alertas · {open.length}</span> },
              { value: "tasks", label: <span className="inline-flex items-center gap-1.5"><ListChecks size={13} /> Tareas · {openTasks.length}</span> },
            ]}
          />
        </div>

        {tab === "alerts" ? <AlertsTab onOpen={(id) => setParam({ alert: id })} /> : <TasksTab onOpen={(id) => setParam({ task: id })} />}
      </div>

      <Drawer open={!!alertId} onClose={() => setParam({ alert: null })} title="Detalle de alerta" width={480}>
        {alertId && <AlertDetail id={alertId} onTask={(id) => setParam({ alert: null, tab: "tasks", task: id })} />}
      </Drawer>
      <Drawer open={!!taskId} onClose={() => setParam({ task: null })} title="Detalle de tarea" width={480}>
        {taskId && <TaskDetail id={taskId} />}
      </Drawer>
      <Drawer open={creating} onClose={() => setCreating(false)} title="Nueva tarea" width={460}>
        {creating && (
          <NewTaskForm
            onCreated={(id) => {
              setCreating(false);
              setParam({ tab: "tasks", task: id });
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="num mt-1 text-2xl font-semibold" style={{ color: tone }}>{value}</p>
    </div>
  );
}

function AlertsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { alerts, dataset, now, setAlertStatus } = useDemo();
  const [status, setStatus] = useState<StatusView>("open");
  const [type, setType] = useState<AlertType | "">("");
  const [priority, setPriority] = useState<AlertPriority | "">("");
  const [team, setTeam] = useState("");

  const rows = useMemo(
    () =>
      alerts
        .filter(
          (a) =>
            (status === "all" || (status === "open" ? a.status !== "resolved" : a.status === status)) &&
            (!type || a.type === type) &&
            (!priority || a.priority === priority) &&
            (!team || a.teamId === team),
        )
        .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) || b.createdAt - a.createdAt),
    [alerts, status, type, priority, team],
  );

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <Segmented<StatusView>
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: "open", label: "Abiertas" },
            { value: "pending", label: "Pendientes" },
            { value: "following", label: "En seguimiento" },
            { value: "resolved", label: "Resueltas" },
            { value: "all", label: "Todas" },
          ]}
        />
        <Select value={type} onChange={(e) => setType(e.target.value as AlertType | "")} className="h-8 text-xs" aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {(Object.keys(ALERT_TYPE_LABEL) as AlertType[]).map((t) => (
            <option key={t} value={t}>{ALERT_TYPE_LABEL[t]}</option>
          ))}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value as AlertPriority | "")} className="h-8 text-xs" aria-label="Prioridad">
          <option value="">Toda prioridad</option>
          {PRIORITY_ORDER.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </Select>
        <Select value={team} onChange={(e) => setTeam(e.target.value)} className="h-8 text-xs" aria-label="Equipo">
          <option value="">Todos los equipos</option>
          {dataset.teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
        <span className="num ml-auto text-xs text-muted">{rows.length} alertas</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No hay alertas con estos criterios" />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((a) => {
            const t = dataset.teams.find((x) => x.id === a.teamId);
            return (
              <li key={a.id} className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-ink/[0.02]">
                <Badge tone={PRIORITY_TONE[a.priority]} className="w-14 justify-center">{PRIORITY_LABEL[a.priority]}</Badge>
                <button onClick={() => onOpen(a.id)} className="min-w-[240px] flex-1 text-left">
                  <p className="text-sm font-medium">
                    {ALERT_TYPE_LABEL[a.type]}
                    {a.penguinId && <span className="ml-2 font-mono text-xs text-muted">{a.penguinId}</span>}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted">{a.description}</p>
                </button>
                <span className="inline-flex w-36 items-center gap-1.5 text-xs text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: t?.color }} />
                  {t?.name}
                </span>
                <span className="w-24 text-xs text-faint">{fmtAgo(a.createdAt, now)}</span>
                <Badge tone={a.status === "resolved" ? "ok" : a.status === "following" ? "info" : "warn"} className="w-28 justify-center">{ALERT_STATUS_LABEL[a.status]}</Badge>
                <div className="flex gap-1">
                  {a.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => setAlertStatus(a.id, "following")} title="Dar seguimiento">
                      <Eye size={13} /> Seguir
                    </Button>
                  )}
                  {a.status !== "resolved" ? (
                    <Button size="sm" variant="outline" onClick={() => setAlertStatus(a.id, "resolved")}>
                      <CheckCircle2 size={13} /> Resolver
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setAlertStatus(a.id, "pending")}>
                      <RotateCcw size={13} /> Reabrir
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onOpen(a.id)} aria-label="Abrir detalle">
                    <ArrowUpRight size={14} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TasksTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { tasks, dataset, now } = useDemo();
  const [status, setStatus] = useState<"open" | TaskStatus | "all">("open");
  const [team, setTeam] = useState("");
  const [kind, setKind] = useState<TaskKind | "">("");

  const rows = tasks
    .filter((t) => (status === "all" || (status === "open" ? isOpenTask(t) : t.status === status)) && (!team || t.teamId === team) && (!kind || t.kind === kind))
    .sort((a, b) => Number(!isOpenTask(a)) - Number(!isOpenTask(b)) || a.dueAt - b.dueAt);
  const groups: { label: string; items: CareTask[] }[] = [
    { label: "Vencidas", items: rows.filter((t) => isOpenTask(t) && t.dueAt < now) },
    { label: "Próximas 24 h", items: rows.filter((t) => isOpenTask(t) && t.dueAt >= now && t.dueAt < now + DAY) },
    { label: "Más adelante", items: rows.filter((t) => isOpenTask(t) && t.dueAt >= now + DAY) },
    { label: "Cerradas", items: rows.filter((t) => !isOpenTask(t)).sort((a, b) => b.history[b.history.length - 1].at - a.history[a.history.length - 1].at) },
  ].filter((g) => g.items.length);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <Segmented
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: "open", label: "Abiertas" },
            { value: "pending", label: "Pendientes" },
            { value: "in_progress", label: "En proceso" },
            { value: "done", label: "Completadas" },
            { value: "cancelled", label: "Canceladas" },
            { value: "all", label: "Todas" },
          ]}
        />
        <Select value={kind} onChange={(e) => setKind(e.target.value as TaskKind | "")} className="h-8 text-xs" aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {(Object.keys(TASK_KIND_LABEL) as TaskKind[]).map((k) => (
            <option key={k} value={k}>{TASK_KIND_LABEL[k]}</option>
          ))}
        </Select>
        <Select value={team} onChange={(e) => setTeam(e.target.value)} className="h-8 text-xs" aria-label="Equipo">
          <option value="">Todos los equipos</option>
          {dataset.teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
        <span className="num ml-auto text-xs text-muted">{rows.length} tareas</span>
      </div>
      {groups.length === 0 ? (
        <EmptyState icon={ListChecks} title="No hay tareas con estos criterios" />
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            <p className={cx("eyebrow border-b border-line bg-ink/[0.015] px-4 py-2", g.label === "Vencidas" && "!text-danger")}>
              {g.label} · {g.items.length}
            </p>
            <ul className="divide-y divide-line">
              {g.items.map((t) => {
                const team = dataset.teams.find((x) => x.id === t.teamId);
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 hover:bg-ink/[0.02]">
                    <button onClick={() => onOpen(t.id)} className="min-w-[240px] flex-1 text-left">
                      <p className="text-sm font-medium">
                        {t.title}
                        {t.penguinId && <span className="ml-2 font-mono text-xs text-muted">{t.penguinId}</span>}
                      </p>
                      <p className="text-[11px] text-faint">
                        {t.id} · {TASK_KIND_LABEL[t.kind]}
                        {t.zoneId && ` · ${ZONE_BY_ID[t.zoneId]?.name}`}
                      </p>
                    </button>
                    <span className="inline-flex w-36 items-center gap-1.5 text-xs text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: team?.color }} />
                      {team?.name}
                    </span>
                    <span className={cx("w-32 text-xs", isOpenTask(t) && t.dueAt < now ? "text-danger" : "text-faint")}>
                      {!isOpenTask(t) ? `${t.status === "cancelled" ? "Cancelada" : "Cerrada"} ${fmtAgo(t.history[t.history.length - 1].at, now)}` : t.dueAt < now ? `Venció ${fmtAgo(t.dueAt, now)}` : `Vence ${fmtAgo(t.dueAt, now)}`}
                    </span>
                    <TaskStatusControl task={t} className="w-32" />
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function History({ items }: { items: { at: number; by: string; text: string }[] }) {
  const { now } = useDemo();
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-line-strong">
      {[...items].reverse().map((h, i) => (
        <li key={i} className="relative pl-5">
          <span className={cx("absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-bg", i === 0 ? "bg-accent" : "bg-line-strong")} />
          <p className="text-sm">{h.text}</p>
          <p className="text-[11px] text-faint">
            {h.by} · {fmtDateTime(h.at, now)}
          </p>
        </li>
      ))}
    </ol>
  );
}

function AlertDetail({ id, onTask }: { id: string; onTask: (taskId: string) => void }) {
  const { alerts, tasks, dataset, setAlertStatus, assignAlert, createTask, config, now } = useDemo();
  const a = alerts.find((x) => x.id === id);
  const [note, setNote] = useState("");
  if (!a) return <EmptyState icon={BellRing} title="La alerta ya no existe en este escenario" />;
  const rule = describeRules(config.rules)[a.type];
  const linkedTask = a.taskId ? tasks.find((t) => t.id === a.taskId) : undefined;

  const act = (s: AlertStatus) => {
    setAlertStatus(a.id, s, note.trim() || undefined);
    setNote("");
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={PRIORITY_TONE[a.priority]}>Prioridad {PRIORITY_LABEL[a.priority].toLowerCase()}</Badge>
          <Badge tone={a.status === "resolved" ? "ok" : a.status === "following" ? "info" : "warn"}>{ALERT_STATUS_LABEL[a.status]}</Badge>
          <span className="font-mono text-[11px] text-faint">{a.id}</span>
        </div>
        <h2 className="mt-3 text-lg font-semibold">{ALERT_TYPE_LABEL[a.type]}</h2>
        <p className="mt-1 text-sm text-muted">{a.description}</p>
        <p className="mt-2 text-[11px] text-faint">Generada {fmtDateTime(a.createdAt, now)} · {fmtAgo(a.createdAt, now)}</p>
      </div>

      <div className="rounded-xl border border-line bg-ink/[0.02] p-3">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <ScrollText size={12} /> Regla que la generó
        </p>
        <p className="text-xs text-ink">{rule}</p>
      </div>

      {a.penguinId && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/penguins/${a.penguinId}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-xs hover:border-accent/50">
            Ficha de <span className="font-mono">{a.penguinId}</span> <ArrowUpRight size={12} />
          </Link>
          <Link href={`/map?penguin=${a.penguinId}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-xs hover:border-accent/50">
            <MapPinned size={12} /> Ver en el mapa
          </Link>
        </div>
      )}

      <div>
        <p className="eyebrow mb-2">Equipo responsable</p>
        <Select value={a.teamId} onChange={(e) => assignAlert(a.id, e.target.value)} className="w-full">
          {dataset.teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name} · {t.lead}</option>
          ))}
        </Select>
      </div>

      <div>
        <p className="eyebrow mb-2">Tarea relacionada</p>
        {linkedTask ? (
          <button onClick={() => onTask(linkedTask.id)} className="flex w-full items-center justify-between rounded-xl border border-line px-3 py-2 text-left text-sm hover:bg-ink/[0.03]">
            <span>{linkedTask.title} <span className="text-[11px] text-faint">· {linkedTask.id}</span></span>
            <Badge tone={linkedTask.status === "done" ? "ok" : "info"}>{TASK_STATUS_LABEL[linkedTask.status]}</Badge>
          </button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={a.status === "resolved"}
            onClick={() => {
              const kind: TaskKind = a.type === "device_offline" || a.type === "stale_location" ? "device_check" : a.type === "care_review_pending" ? "routine_review" : "observation_followup";
              const tid = createTask({
                kind,
                title: kind === "device_check" ? "Verificar dispositivo y lectura" : kind === "routine_review" ? "Revisión de rutina" : "Seguimiento de observación",
                teamId: a.teamId,
                penguinId: a.penguinId,
                dueAt: now + 4 * HOUR,
                notes: `Creada desde la alerta ${a.id}.`,
              });
              setAlertStatus(a.id, "following", `Tarea ${tid} creada para el seguimiento.`);
              onTask(tid);
            }}
          >
            <Plus size={13} /> Crear tarea para el equipo
          </Button>
        )}
      </div>

      <div>
        <p className="eyebrow mb-2">Cambiar estado</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota opcional para el historial…"
          rows={2}
          className="w-full rounded-xl border border-line-strong bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent/60"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {a.status !== "following" && a.status !== "resolved" && (
            <Button size="sm" variant="outline" onClick={() => act("following")}>
              <Eye size={13} /> Dar seguimiento
            </Button>
          )}
          {a.status !== "resolved" ? (
            <Button size="sm" variant="primary" onClick={() => act("resolved")}>
              <CheckCircle2 size={13} /> Resolver
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => act("pending")}>
              <RotateCcw size={13} /> Reabrir
            </Button>
          )}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3">Historial de resolución</p>
        <History items={a.history} />
      </div>
    </div>
  );
}

function TaskDetail({ id }: { id: string }) {
  const { tasks, dataset, assignTask, setTaskStatus, now } = useDemo();
  const t = tasks.find((x) => x.id === id);
  const [note, setNote] = useState("");
  if (!t) return <EmptyState icon={ListChecks} title="La tarea ya no existe en este escenario" />;

  return (
    <div className="space-y-5 p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{TASK_KIND_LABEL[t.kind]}</Badge>
          <Badge tone={t.status === "done" ? "ok" : t.status === "in_progress" ? "info" : t.status === "cancelled" ? "neutral" : "warn"}>{TASK_STATUS_LABEL[t.status]}</Badge>
          <span className="font-mono text-[11px] text-faint">{t.id}</span>
        </div>
        <h2 className="mt-3 text-lg font-semibold">{t.title}</h2>
        {t.notes && <p className="mt-1 text-sm text-muted">{t.notes}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[11px] text-muted">Fecha límite</dt>
            <dd className={isOpenTask(t) && t.dueAt < now ? "text-danger" : ""}>{fmtDateTime(t.dueAt, now)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">Creada</dt>
            <dd>{fmtDateTime(t.createdAt, now)}</dd>
          </div>
          {t.penguinId && (
            <div>
              <dt className="text-[11px] text-muted">Ejemplar</dt>
              <dd>
                <Link href={`/penguins/${t.penguinId}`} className="font-mono text-accent hover:underline">{t.penguinId}</Link>
              </dd>
            </div>
          )}
          {t.zoneId && (
            <div>
              <dt className="text-[11px] text-muted">Zona</dt>
              <dd>{ZONE_BY_ID[t.zoneId]?.name}</dd>
            </div>
          )}
        </dl>
      </div>

      <div>
        <p className="eyebrow mb-2">Asignar a equipo</p>
        <Select value={t.teamId} onChange={(e) => assignTask(t.id, e.target.value)} className="w-full">
          {dataset.teams.map((x) => (
            <option key={x.id} value={x.id}>{x.name} · {x.lead}</option>
          ))}
        </Select>
      </div>

      <div>
        <p className="eyebrow mb-2">Cambiar estado</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota opcional para el historial…"
          rows={2}
          className="w-full rounded-xl border border-line-strong bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent/60"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[])
            .filter((s) => s !== t.status)
            .map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === "done" ? "primary" : "outline"}
                onClick={() => {
                  setTaskStatus(t.id, s, note.trim() || undefined);
                  setNote("");
                }}
              >
                {s === "done" ? "Marcar completada" : s === "in_progress" ? "Tomar / en proceso" : s === "cancelled" ? "Cancelar" : "Regresar a pendiente"}
              </Button>
            ))}
        </div>
        {t.kind === "routine_review" && isOpenTask(t) && (
          <p className="mt-2 text-[11px] text-faint">Al completarla se registra la revisión y se resuelve la alerta de revisión pendiente del ejemplar.</p>
        )}
      </div>

      <div>
        <p className="eyebrow mb-3">Historial</p>
        <History items={t.history} />
      </div>
    </div>
  );
}

function NewTaskForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { dataset, createTask, teamOf, now, filters } = useDemo();
  const [kind, setKind] = useState<TaskKind>("routine_review");
  const [title, setTitle] = useState(TASK_KIND_LABEL.routine_review);
  const [touchedTitle, setTouchedTitle] = useState(false);
  const [penguinId, setPenguinId] = useState("");
  const [teamId, setTeamId] = useState(filters.teams[0] ?? dataset.teams[0].id);
  const [zoneId, setZoneId] = useState("");
  const [due, setDue] = useState(() => toLocalInput(now + 4 * HOUR));
  const [notes, setNotes] = useState("");
  const dueTs = new Date(due).getTime();
  const valid = title.trim() && Number.isFinite(dueTs);

  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onCreated(createTask({ kind, title: title.trim(), teamId, penguinId: penguinId || undefined, zoneId: zoneId || undefined, dueAt: dueTs, notes: notes.trim() || undefined }));
      }}
    >
      <Field label="Tipo">
        <Select
          value={kind}
          onChange={(e) => {
            const k = e.target.value as TaskKind;
            setKind(k);
            if (!touchedTitle) setTitle(TASK_KIND_LABEL[k]);
          }}
          className="w-full"
        >
          {(Object.keys(TASK_KIND_LABEL) as TaskKind[]).map((k) => (
            <option key={k} value={k}>{TASK_KIND_LABEL[k]}</option>
          ))}
        </Select>
      </Field>
      <Field label="Título">
        <input
          value={title}
          onChange={(e) => (setTitle(e.target.value), setTouchedTitle(true))}
          className="h-9 w-full rounded-xl border border-line-strong bg-panel-solid px-3 text-sm outline-none focus:border-accent/60"
        />
      </Field>
      <Field label="Ejemplar (opcional)">
        <Select
          value={penguinId}
          onChange={(e) => {
            setPenguinId(e.target.value);
            if (e.target.value) setTeamId(teamOf(e.target.value));
          }}
          className="w-full"
        >
          <option value="">Sin ejemplar</option>
          {dataset.penguins.map((p) => (
            <option key={p.id} value={p.id}>{p.id}</option>
          ))}
        </Select>
      </Field>
      <Field label="Equipo asignado">
        <Select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-full">
          {dataset.teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
        {penguinId && teamOf(penguinId) !== teamId && <p className="mt-1 text-[11px] text-warn">El ejemplar pertenece a otro equipo; la tarea se asignará a {dataset.teams.find((t) => t.id === teamId)?.name}.</p>}
      </Field>
      <Field label="Zona (opcional)">
        <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="w-full">
          <option value="">Sin zona</option>
          {PENGUIN_ZONES.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Fecha límite">
        <input
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="h-9 w-full rounded-xl border border-line-strong bg-panel-solid px-3 text-sm outline-none focus:border-accent/60"
        />
      </Field>
      <Field label="Notas">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-line-strong bg-panel-solid px-3 py-2 text-sm outline-none focus:border-accent/60" />
      </Field>
      <Button type="submit" variant="primary" disabled={!valid} className="w-full">
        <Plus size={15} /> Crear tarea
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] text-muted">{label}</span>
      {children}
    </label>
  );
}

function toLocalInput(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
