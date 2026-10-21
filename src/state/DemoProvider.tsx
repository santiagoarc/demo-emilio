"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_CONFIG, type DemoConfig } from "@/config/demo.config";
import { createSimulatedSource } from "@/data/source";
import { ZONE_BY_ID } from "@/domain/habitat";
import type { Alert, AlertStatus, CareNote, CareTask, CareTeam, Dataset, Incident, Penguin, Shift, TaskKind, TaskStatus, TrackingDevice } from "@/domain/types";
import { evaluateAlertRules } from "@/logic/alertRules";
import { EMPTY_FILTERS, resolveRange, type Filters, type ResolvedRange } from "@/logic/filters";
import { snapshotAt, type Snapshot } from "@/logic/status";
import { MIN } from "@/logic/time";
import { clearPersisted, loadPersisted, savePersisted, shiftPersisted } from "./persistence";
import { isOpenTask } from "@/logic/tasks";

export const CURRENT_USER = "Usuario demo";

/**
 * Permisos del usuario de la demo. Cuando haya autenticación real vendrán de su
 * rol; mientras tanto la demo deja editar para poder mostrar los flujos.
 */
export const PERMISSIONS = {
  role: "Coordinación de cuidado (demo)",
  reassignTeam: true,
  addObservation: true,
  manageAlerts: true,
  manageTasks: true,
  manageTeams: true,
};

/** Cambio registrado en un equipo (composición, roles, estado, turnos). */
export interface TeamLogEntry {
  id: string;
  teamId: string;
  at: number;
  by: string;
  text: string;
}

export interface TeamInput {
  name: string;
  focus: string;
  lead: string;
  members: string[];
  zoneIds: string[];
  active: boolean;
  roles?: Record<string, string>;
}

const NEW_TEAM_COLORS = ["#F472B6", "#FB923C", "#4ADE80", "#60A5FA", "#FACC15", "#C084FC"];

interface CoreState {
  config: DemoConfig;
  dataset: Dataset;
  assignments: Record<string, string>;
  tasks: CareTask[];
  alerts: Alert[];
  reviews: Record<string, number>;
  log: Incident[];
  userNotes: CareNote[];
  customTeams: CareTeam[];
  teamEdits: Record<string, Partial<CareTeam>>;
  teamLog: TeamLogEntry[];
  shifts: Shift[];
  filters: Filters;
  taskSeq: number;
}

export interface NewTaskInput {
  kind: TaskKind;
  title: string;
  teamId: string;
  dueAt: number;
  penguinId?: string;
  zoneId?: string;
  notes?: string;
  assignee?: string;
}

export interface DemoContextValue extends CoreState {
  now: number;
  sourceLabel: string;
  range: ResolvedRange;
  penguinById: Map<string, Penguin>;
  deviceById: Map<string, TrackingDevice>;
  teamOf: (penguinId: string) => string;
  lastReviewOf: (penguinId: string) => number;
  snapshots: Map<string, Snapshot>;
  /** Ejemplares que pasan especie/equipo/ejemplar (sin el filtro de zona). */
  scoped: Penguin[];
  /** Además filtrados por la zona actual registrada. */
  visible: Penguin[];
  setFilters: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  reassign: (penguinId: string, teamId: string) => void;
  setTaskStatus: (taskId: string, status: TaskStatus, note?: string) => void;
  assignTask: (taskId: string, teamId: string) => void;
  createTask: (input: NewTaskInput) => string;
  setAlertStatus: (alertId: string, status: AlertStatus, note?: string) => void;
  assignAlert: (alertId: string, teamId: string) => void;
  addNote: (penguinId: string, text: string) => void;
  updateTask: (taskId: string, patch: Partial<Pick<CareTask, "title" | "notes" | "assignee" | "dueAt" | "penguinId" | "zoneId">>) => void;
  addTeam: (input: TeamInput) => string;
  updateTeam: (teamId: string, patch: Partial<TeamInput>) => void;
  addShift: (shift: Omit<Shift, "id">) => void;
  removeShift: (shiftId: string) => void;
  resetDemo: (config?: DemoConfig) => void;
}

const Ctx = createContext<DemoContextValue | null>(null);

function roundNow(slotMinutes: number) {
  const slot = slotMinutes * MIN;
  return Math.floor(Date.now() / slot) * slot;
}

function freshState(config: DemoConfig, filters: Filters = EMPTY_FILTERS): CoreState {
  const dataset = createSimulatedSource(config).load(roundNow(config.slotMinutes));
  const initialTeam = new Map(dataset.penguins.map((p) => [p.id, p.initialTeamId]));
  const alerts = evaluateAlertRules(dataset, dataset.tasks, (id) => initialTeam.get(id)!, config.rules);
  return { config, dataset, assignments: {}, tasks: dataset.tasks, alerts, reviews: {}, log: [], userNotes: [], customTeams: [], teamEdits: {}, teamLog: [], shifts: [], filters, taskSeq: 1 };
}

function restoreState(): CoreState {
  const saved = loadPersisted();
  if (!saved) return freshState(DEFAULT_CONFIG);
  const now = roundNow(saved.config.slotMinutes);
  const s = shiftPersisted(saved, now - saved.savedNow);
  const dataset = createSimulatedSource(s.config).load(now);
  const ids = new Set(dataset.penguins.map((p) => p.id));
  return {
    config: s.config,
    dataset,
    assignments: Object.fromEntries(Object.entries(s.assignments).filter(([id]) => ids.has(id))),
    tasks: s.tasks,
    alerts: s.alerts,
    reviews: s.reviews,
    log: s.log,
    userNotes: s.userNotes ?? [],
    customTeams: s.customTeams ?? [],
    teamEdits: s.teamEdits ?? {},
    teamLog: s.teamLog ?? [],
    shifts: s.shifts ?? [],
    filters: { ...EMPTY_FILTERS, ...s.filters },
    taskSeq: s.taskSeq ?? 1,
  };
}

/** Hora de una acción del usuario: el reloj del escenario más lo transcurrido en la sesión. */
function useActionClock(datasetNow: number) {
  const loadedAt = useRef(0);
  useEffect(() => {
    loadedAt.current = Date.now();
  }, [datasetNow]);
  return useCallback(() => datasetNow + Math.max(0, Date.now() - (loadedAt.current || Date.now())), [datasetNow]);
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CoreState | null>(null);

  useEffect(() => {
    // Los datos dependen de la hora del navegador: se generan solo en el cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(restoreState());
  }, []);

  useEffect(() => {
    if (!state) return;
    const id = window.setTimeout(() => {
      savePersisted({
        v: 1,
        savedNow: state.dataset.now,
        config: state.config,
        assignments: state.assignments,
        tasks: state.tasks,
        alerts: state.alerts,
        reviews: state.reviews,
        log: state.log,
        userNotes: state.userNotes,
        customTeams: state.customTeams,
        teamEdits: state.teamEdits,
        teamLog: state.teamLog,
        shifts: state.shifts,
        filters: state.filters,
        taskSeq: state.taskSeq,
      });
    }, 250);
    return () => window.clearTimeout(id);
  }, [state]);

  if (!state) return <BootScreen />;
  return <DemoContextInner state={state} setState={setState as React.Dispatch<React.SetStateAction<CoreState>>}>{children}</DemoContextInner>;
}

function DemoContextInner({
  state,
  setState,
  children,
}: {
  state: CoreState;
  setState: React.Dispatch<React.SetStateAction<CoreState>>;
  children: ReactNode;
}) {
  const { dataset: baseDataset, assignments, reviews, filters, config, customTeams, teamEdits } = state;
  const clock = useActionClock(baseDataset.now);

  // Equipos vigentes: los del escenario con sus ediciones, más los creados en la demo.
  const dataset = useMemo(() => {
    const teams = [...baseDataset.teams, ...customTeams].map((t) => ({ ...t, ...teamEdits[t.id] }));
    return { ...baseDataset, teams };
  }, [baseDataset, customTeams, teamEdits]);

  const penguinById = useMemo(() => new Map(dataset.penguins.map((p) => [p.id, p])), [dataset]);
  const deviceById = useMemo(() => new Map(dataset.devices.map((d) => [d.id, d])), [dataset]);
  const teamOf = useCallback((id: string) => assignments[id] ?? penguinById.get(id)?.initialTeamId ?? "", [assignments, penguinById]);
  const lastReviewOf = useCallback((id: string) => reviews[id] ?? penguinById.get(id)?.lastReviewAt ?? 0, [reviews, penguinById]);

  const snapshots = useMemo(() => {
    const m = new Map<string, Snapshot>();
    for (const p of dataset.penguins) m.set(p.id, snapshotAt(dataset, deviceById, config.rules, p, dataset.now));
    return m;
  }, [dataset, deviceById, config.rules]);

  const scoped = useMemo(
    () =>
      dataset.penguins.filter(
        (p) =>
          (!filters.species.length || filters.species.includes(p.speciesId)) &&
          (!filters.teams.length || filters.teams.includes(teamOf(p.id))) &&
          (!filters.penguinId || filters.penguinId === p.id),
      ),
    [dataset, filters.species, filters.teams, filters.penguinId, teamOf],
  );
  const visible = useMemo(
    () => (filters.zones.length ? scoped.filter((p) => filters.zones.includes(snapshots.get(p.id)?.reading?.zoneId ?? "")) : scoped),
    [scoped, filters.zones, snapshots],
  );
  const range = useMemo(() => resolveRange(filters, dataset), [filters, dataset]);

  const setFilters = useCallback((patch: Partial<Filters>) => setState((s) => ({ ...s, filters: { ...s.filters, ...patch } })), [setState]);
  const clearFilters = useCallback(() => setState((s) => ({ ...s, filters: { ...EMPTY_FILTERS, range: s.filters.range, customFrom: s.filters.customFrom, customTo: s.filters.customTo } })), [setState]);

  const teamName = useCallback((id: string) => dataset.teams.find((t) => t.id === id)?.name ?? id, [dataset]);

  const reassign = useCallback(
    (penguinId: string, teamId: string) =>
      setState((s) => {
        const from = s.assignments[penguinId] ?? s.dataset.penguins.find((p) => p.id === penguinId)!.initialTeamId;
        if (from === teamId) return s;
        const at = clock();
        const text = `Reasignado de ${teamName(from)} a ${teamName(teamId)}.`;
        return {
          ...s,
          assignments: { ...s.assignments, [penguinId]: teamId },
          tasks: s.tasks.map((t) =>
            t.penguinId === penguinId && isOpenTask(t)
              ? { ...t, teamId, history: [...t.history, { at, by: CURRENT_USER, text: `Tarea movida a ${teamName(teamId)} por reasignación del ejemplar.` }] }
              : t,
          ),
          alerts: s.alerts.map((a) =>
            a.penguinId === penguinId && a.status !== "resolved"
              ? { ...a, teamId, history: [...a.history, { at, by: CURRENT_USER, text: `Alerta movida a ${teamName(teamId)} por reasignación del ejemplar.` }] }
              : a,
          ),
          log: [{ id: `LOG-${at}-${penguinId}`, penguinId, at, kind: "assignment", text }, ...s.log],
        };
      }),
    [setState, clock, teamName],
  );

  const setTaskStatus = useCallback(
    (taskId: string, status: TaskStatus, note?: string) =>
      setState((s) => {
        const task = s.tasks.find((t) => t.id === taskId);
        if (!task || task.status === status) return s;
        const at = clock();
        const label = status === "done" ? "Completada" : status === "in_progress" ? "En proceso" : status === "cancelled" ? "Cancelada" : "Regresada a pendiente";
        const tasks = s.tasks.map((t) =>
          t.id === taskId ? { ...t, status, history: [...t.history, { at, by: CURRENT_USER, text: note ? `${label}: ${note}` : `${label}.` }] } : t,
        );
        let { reviews, alerts } = s;
        if (status === "cancelled") {
          alerts = alerts.map((a) =>
            a.status !== "resolved" && a.taskId === taskId ? { ...a, status: "resolved", history: [...a.history, { at, by: CURRENT_USER, text: `Cerrada al cancelar ${taskId}.` }] } : a,
          );
        }
        if (status === "done") {
          if (task.kind === "routine_review" && task.penguinId) reviews = { ...reviews, [task.penguinId]: at };
          alerts = alerts.map((a) => {
            const linked =
              a.status !== "resolved" &&
              (a.taskId === taskId || (task.kind === "routine_review" && a.type === "care_review_pending" && a.penguinId === task.penguinId));
            return linked ? { ...a, status: "resolved", history: [...a.history, { at, by: CURRENT_USER, text: `Resuelta al completar ${taskId}.` }] } : a;
          });
        }
        return { ...s, tasks, reviews, alerts };
      }),
    [setState, clock],
  );

  const assignTask = useCallback(
    (taskId: string, teamId: string) =>
      setState((s) => {
        const at = clock();
        return {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId && t.teamId !== teamId ? { ...t, teamId, history: [...t.history, { at, by: CURRENT_USER, text: `Asignada a ${teamName(teamId)}.` }] } : t,
          ),
        };
      }),
    [setState, clock, teamName],
  );

  const createTask = useCallback(
    (input: NewTaskInput) => {
      const id = `TSK-U${String(state.taskSeq).padStart(3, "0")}`;
      setState((s) => {
        const at = clock();
        const zoneName = input.zoneId ? ZONE_BY_ID[input.zoneId]?.name : undefined;
        const task: CareTask = {
          id,
          ...input,
          createdAt: at,
          status: "pending",
          history: [{ at, by: CURRENT_USER, text: `Creada y asignada a ${teamName(input.teamId)}${zoneName ? ` · ${zoneName}` : ""}.` }],
        };
        return { ...s, tasks: [task, ...s.tasks], taskSeq: s.taskSeq + 1 };
      });
      return id;
    },
    [setState, clock, teamName, state.taskSeq],
  );

  const setAlertStatus = useCallback(
    (alertId: string, status: AlertStatus, note?: string) =>
      setState((s) => {
        const at = clock();
        const label = status === "resolved" ? "Resuelta" : status === "following" ? "En seguimiento" : "Reabierta";
        return {
          ...s,
          alerts: s.alerts.map((a) =>
            a.id === alertId && a.status !== status ? { ...a, status, history: [...a.history, { at, by: CURRENT_USER, text: note ? `${label}: ${note}` : `${label}.` }] } : a,
          ),
        };
      }),
    [setState, clock],
  );

  const assignAlert = useCallback(
    (alertId: string, teamId: string) =>
      setState((s) => {
        const at = clock();
        return {
          ...s,
          alerts: s.alerts.map((a) =>
            a.id === alertId && a.teamId !== teamId ? { ...a, teamId, history: [...a.history, { at, by: CURRENT_USER, text: `Asignada a ${teamName(teamId)}.` }] } : a,
          ),
        };
      }),
    [setState, clock, teamName],
  );

  const addNote = useCallback(
    (penguinId: string, text: string) =>
      setState((s) => {
        const at = clock();
        const note: CareNote = { id: `NOTE-U${at}-${penguinId}`, penguinId, at, by: CURRENT_USER, text, simulated: false };
        return { ...s, userNotes: [note, ...s.userNotes] };
      }),
    [setState, clock],
  );

  const updateTask = useCallback(
    (taskId: string, patch: Partial<Pick<CareTask, "title" | "notes" | "assignee" | "dueAt" | "penguinId" | "zoneId">>) =>
      setState((s) => {
        const at = clock();
        return {
          ...s,
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const changes: string[] = [];
            if (patch.title !== undefined && patch.title !== t.title) changes.push("nombre");
            if (patch.notes !== undefined && patch.notes !== (t.notes ?? "")) changes.push("descripción");
            if ("assignee" in patch && patch.assignee !== t.assignee) changes.push(patch.assignee ? `responsable: ${patch.assignee}` : "sin responsable");
            if (patch.dueAt !== undefined && patch.dueAt !== t.dueAt) changes.push("vencimiento");
            if ("penguinId" in patch && patch.penguinId !== t.penguinId) changes.push("ejemplar");
            if ("zoneId" in patch && patch.zoneId !== t.zoneId) changes.push("zona");
            if (!changes.length) return t;
            return { ...t, ...patch, history: [...t.history, { at, by: CURRENT_USER, text: `Editada (${changes.join(", ")}).` }] };
          }),
        };
      }),
    [setState, clock],
  );

  const addTeam = useCallback(
    (input: TeamInput) => {
      const id = `team-u${state.customTeams.length + 1}-${Date.now().toString(36)}`;
      setState((s) => {
        const at = clock();
        const team: CareTeam = {
          id,
          name: input.name,
          focus: input.focus,
          lead: input.lead,
          members: input.members.includes(input.lead) ? input.members : [input.lead, ...input.members],
          zoneIds: input.zoneIds,
          active: input.active,
          roles: input.roles,
          color: NEW_TEAM_COLORS[s.customTeams.length % NEW_TEAM_COLORS.length],
        };
        return {
          ...s,
          customTeams: [...s.customTeams, team],
          teamLog: [{ id: `TL-${at}-${id}`, teamId: id, at, by: CURRENT_USER, text: `Equipo creado (${input.active ? "activo" : "inactivo"}).` }, ...s.teamLog],
        };
      });
      return id;
    },
    [setState, clock, state.customTeams.length],
  );

  const updateTeam = useCallback(
    (teamId: string, patch: Partial<TeamInput>) =>
      setState((s) => {
        const at = clock();
        const before = [...s.dataset.teams, ...s.customTeams].map((t) => ({ ...t, ...s.teamEdits[t.id] })).find((t) => t.id === teamId);
        if (!before) return s;
        const texts: string[] = [];
        if (patch.name !== undefined && patch.name !== before.name) texts.push(`Nombre: «${before.name}» → «${patch.name}».`);
        if (patch.focus !== undefined && patch.focus !== before.focus) texts.push("Descripción actualizada.");
        if (patch.lead !== undefined && patch.lead !== before.lead) texts.push(`Responsable: ${before.lead} → ${patch.lead}.`);
        if (patch.members) {
          const added = patch.members.filter((m) => !before.members.includes(m));
          const removed = before.members.filter((m) => !patch.members!.includes(m));
          if (added.length) texts.push(`Integrante${added.length > 1 ? "s" : ""} agregado${added.length > 1 ? "s" : ""}: ${added.join(", ")}.`);
          if (removed.length) texts.push(`Integrante${removed.length > 1 ? "s" : ""} retirado${removed.length > 1 ? "s" : ""}: ${removed.join(", ")}.`);
        }
        if (patch.zoneIds && patch.zoneIds.join() !== before.zoneIds.join()) texts.push("Zonas de responsabilidad actualizadas.");
        if (patch.active !== undefined && patch.active !== (before.active ?? true)) texts.push(patch.active ? "Equipo reactivado." : "Equipo desactivado (sus pingüinos siguen asignados).");
        if (patch.roles) {
          for (const [m, r] of Object.entries(patch.roles)) if ((before.roles?.[m] ?? "") !== r) texts.push(`Rol de ${m}: ${r || "sin rol"}.`);
        }
        if (!texts.length) return s;
        const next: Partial<CareTeam> = { ...s.teamEdits[teamId], ...patch };
        if (next.members && next.lead && !next.members.includes(next.lead)) next.members = [next.lead, ...next.members];
        return {
          ...s,
          teamEdits: { ...s.teamEdits, [teamId]: next },
          teamLog: [...texts.map((text, i) => ({ id: `TL-${at}-${teamId}-${i}`, teamId, at, by: CURRENT_USER, text })), ...s.teamLog],
        };
      }),
    [setState, clock],
  );

  const addShift = useCallback(
    (shift: Omit<Shift, "id">) =>
      setState((s) => {
        const at = clock();
        const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        return {
          ...s,
          shifts: [...s.shifts, { ...shift, id: `SH-${at}-${s.shifts.length}` }],
          teamLog: [{ id: `TL-${at}-sh`, teamId: shift.teamId, at, by: CURRENT_USER, text: `Turno configurado: ${shift.member}, ${DAYS[shift.weekday]} ${shift.start}–${shift.end}.` }, ...s.teamLog],
        };
      }),
    [setState, clock],
  );

  const removeShift = useCallback(
    (shiftId: string) =>
      setState((s) => {
        const sh = s.shifts.find((x) => x.id === shiftId);
        if (!sh) return s;
        const at = clock();
        return {
          ...s,
          shifts: s.shifts.filter((x) => x.id !== shiftId),
          teamLog: [{ id: `TL-${at}-shx`, teamId: sh.teamId, at, by: CURRENT_USER, text: `Turno retirado: ${sh.member} ${sh.start}–${sh.end}.` }, ...s.teamLog],
        };
      }),
    [setState, clock],
  );

  const resetDemo = useCallback(
    (cfg?: DemoConfig) => {
      clearPersisted();
      setState((s) => freshState(cfg ?? DEFAULT_CONFIG, { ...EMPTY_FILTERS, range: s.filters.range }));
    },
    [setState],
  );

  const value: DemoContextValue = {
    ...state,
    dataset,
    now: dataset.now,
    sourceLabel: "Demo · Datos simulados",
    range,
    penguinById,
    deviceById,
    teamOf,
    lastReviewOf,
    snapshots,
    scoped,
    visible,
    setFilters,
    clearFilters,
    reassign,
    setTaskStatus,
    assignTask,
    createTask,
    setAlertStatus,
    assignAlert,
    addNote,
    updateTask,
    addTeam,
    updateTeam,
    addShift,
    removeShift,
    resetDemo,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo(): DemoContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDemo fuera de DemoProvider");
  return v;
}

function BootScreen() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-12 w-12">
          <span className="absolute inset-0 rounded-full border-2 border-[var(--accent)]/20" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--accent)]" />
        </div>
        <p className="text-sm text-[var(--muted)]">Generando escenario de demostración…</p>
      </div>
    </div>
  );
}
