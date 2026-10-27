"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_CONFIG, type DemoConfig } from "@/config/demo.config";
import { seedHealthCases } from "@/data/healthCases";
import { createSimulatedSource } from "@/data/source";
import { penguinInsight, speciesBaselines, type PenguinInsight } from "@/logic/insights";
import type { CareNote, CareTeam, Dataset, HealthCase, HealthReason, Incident, Penguin, Shift, TrackingDevice } from "@/domain/types";
import { EMPTY_FILTERS, resolveRange, type Filters, type ResolvedRange } from "@/logic/filters";
import { snapshotAt, type Snapshot } from "@/logic/status";
import { MIN } from "@/logic/time";
import { clearPersisted, loadPersisted, savePersisted, shiftPersisted } from "./persistence";

export const CURRENT_USER = "Demo user";

/**
 * Demo user permissions. With real authentication they would come from the
 * user's role; for now the demo allows editing so the flows can be shown.
 */
export const PERMISSIONS = {
  role: "Animal care coordinator (demo)",
  reassignTeam: true,
  addObservation: true,
  manageTeams: true,
};

/** Logged change to a team (members, roles, status, shifts). */
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
  log: Incident[];
  userNotes: CareNote[];
  customTeams: CareTeam[];
  teamEdits: Record<string, Partial<CareTeam>>;
  teamLog: TeamLogEntry[];
  shifts: Shift[];
  cases: HealthCase[];
  filters: Filters;
}

export interface NewCaseInput {
  penguinId: string;
  reason: HealthReason;
  title: string;
  owner: string;
  text: string;
  weightKg?: number;
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
  /** "How is it doing?" for each penguin over the last 24 h, vs. its species and vs. itself. */
  insights: Map<string, PenguinInsight>;
  /** Penguins passing the species/team/penguin filters (without the zone filter). */
  scoped: Penguin[];
  /** Additionally filtered by current recorded zone. */
  visible: Penguin[];
  setFilters: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  reassign: (penguinId: string, teamId: string) => void;
  addNote: (penguinId: string, text: string) => void;
  addTeam: (input: TeamInput) => string;
  updateTeam: (teamId: string, patch: Partial<TeamInput>) => void;
  addShift: (shift: Omit<Shift, "id">) => void;
  removeShift: (shiftId: string) => void;
  openCase: (input: NewCaseInput) => string;
  addCaseEntry: (caseId: string, text: string, weightKg?: number) => void;
  closeCase: (caseId: string, text: string) => void;
  resetDemo: (config?: DemoConfig) => void;
}

const Ctx = createContext<DemoContextValue | null>(null);

function roundNow(slotMinutes: number) {
  const slot = slotMinutes * MIN;
  return Math.floor(Date.now() / slot) * slot;
}

function freshState(config: DemoConfig, filters: Filters = EMPTY_FILTERS): CoreState {
  const dataset = createSimulatedSource(config).load(roundNow(config.slotMinutes));
  return { config, dataset, assignments: {}, log: [], userNotes: [], customTeams: [], teamEdits: {}, teamLog: [], shifts: [], cases: seedHealthCases(dataset, config.seed), filters };
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
    log: s.log,
    userNotes: s.userNotes ?? [],
    customTeams: s.customTeams ?? [],
    teamEdits: s.teamEdits ?? {},
    teamLog: s.teamLog ?? [],
    shifts: s.shifts ?? [],
    cases: s.cases ? s.cases.filter((c) => ids.has(c.penguinId)) : seedHealthCases(dataset, s.config.seed),
    filters: { ...EMPTY_FILTERS, ...s.filters },
  };
}

/** Time of a user action: the scenario clock plus time elapsed in the session. */
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
    // Data depends on the browser clock: generated on the client only.
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
        log: state.log,
        userNotes: state.userNotes,
        customTeams: state.customTeams,
        teamEdits: state.teamEdits,
        teamLog: state.teamLog,
        shifts: state.shifts,
        cases: state.cases,
        filters: state.filters,
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
  const { dataset: baseDataset, assignments, filters, config, customTeams, teamEdits } = state;
  const clock = useActionClock(baseDataset.now);

  // Current teams: the scenario's, with edits applied, plus any created in the demo.
  const dataset = useMemo(() => {
    const teams = [...baseDataset.teams, ...customTeams].map((t) => ({ ...t, ...teamEdits[t.id] }));
    return { ...baseDataset, teams };
  }, [baseDataset, customTeams, teamEdits]);

  const penguinById = useMemo(() => new Map(dataset.penguins.map((p) => [p.id, p])), [dataset]);
  const deviceById = useMemo(() => new Map(dataset.devices.map((d) => [d.id, d])), [dataset]);
  const teamOf = useCallback((id: string) => assignments[id] ?? penguinById.get(id)?.initialTeamId ?? "", [assignments, penguinById]);
  const lastReviewOf = useCallback((id: string) => penguinById.get(id)?.lastReviewAt ?? 0, [penguinById]);

  const snapshots = useMemo(() => {
    const m = new Map<string, Snapshot>();
    for (const p of dataset.penguins) m.set(p.id, snapshotAt(dataset, deviceById, config.rules, p, dataset.now));
    return m;
  }, [dataset, deviceById, config.rules]);

  const insights = useMemo(() => {
    const base = speciesBaselines(dataset);
    const m = new Map<string, PenguinInsight>();
    for (const p of dataset.penguins) m.set(p.id, penguinInsight(dataset, p, base.get(p.speciesId)));
    return m;
  }, [dataset]);

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
        const text = `Reassigned from ${teamName(from)} to ${teamName(teamId)}.`;
        return {
          ...s,
          assignments: { ...s.assignments, [penguinId]: teamId },
          log: [{ id: `LOG-${at}-${penguinId}`, penguinId, at, kind: "assignment", text }, ...s.log],
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

  const openCase = useCallback(
    (input: NewCaseInput) => {
      const id = `HC-U${Date.now().toString(36)}-${input.penguinId}`;
      setState((s) => {
        const at = clock();
        const entry = { id: `${id}-0`, at, by: CURRENT_USER, text: input.text, weightKg: input.weightKg };
        const hc: HealthCase = { id, penguinId: input.penguinId, reason: input.reason, title: input.title, owner: input.owner, openedAt: at, status: "open", entries: [entry], simulated: false };
        return { ...s, cases: [hc, ...s.cases] };
      });
      return id;
    },
    [setState, clock],
  );

  const addCaseEntry = useCallback(
    (caseId: string, text: string, weightKg?: number) =>
      setState((s) => {
        const at = clock();
        return { ...s, cases: s.cases.map((c) => (c.id === caseId ? { ...c, entries: [{ id: `${caseId}-${at}`, at, by: CURRENT_USER, text, weightKg }, ...c.entries] } : c)) };
      }),
    [setState, clock],
  );

  const closeCase = useCallback(
    (caseId: string, text: string) =>
      setState((s) => {
        const at = clock();
        return {
          ...s,
          cases: s.cases.map((c) =>
            c.id === caseId ? { ...c, status: "closed" as const, closedAt: at, entries: [{ id: `${caseId}-${at}`, at, by: CURRENT_USER, text: text || "Case closed." }, ...c.entries] } : c,
          ),
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
          teamLog: [{ id: `TL-${at}-${id}`, teamId: id, at, by: CURRENT_USER, text: `Team created (${input.active ? "active" : "inactive"}).` }, ...s.teamLog],
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
        if (patch.name !== undefined && patch.name !== before.name) texts.push(`Name: “${before.name}” → “${patch.name}”.`);
        if (patch.focus !== undefined && patch.focus !== before.focus) texts.push("Description updated.");
        if (patch.lead !== undefined && patch.lead !== before.lead) texts.push(`Lead: ${before.lead} → ${patch.lead}.`);
        if (patch.members) {
          const added = patch.members.filter((m) => !before.members.includes(m));
          const removed = before.members.filter((m) => !patch.members!.includes(m));
          if (added.length) texts.push(`Member${added.length > 1 ? "s" : ""} added: ${added.join(", ")}.`);
          if (removed.length) texts.push(`Member${removed.length > 1 ? "s" : ""} removed: ${removed.join(", ")}.`);
        }
        if (patch.zoneIds && patch.zoneIds.join() !== before.zoneIds.join()) texts.push("Zones of responsibility updated.");
        if (patch.active !== undefined && patch.active !== (before.active ?? true)) texts.push(patch.active ? "Team reactivated." : "Team deactivated (its penguins remain assigned).");
        if (patch.roles) {
          for (const [m, r] of Object.entries(patch.roles)) if ((before.roles?.[m] ?? "") !== r) texts.push(`Role for ${m}: ${r || "no role"}.`);
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
        const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        return {
          ...s,
          shifts: [...s.shifts, { ...shift, id: `SH-${at}-${s.shifts.length}` }],
          teamLog: [{ id: `TL-${at}-sh`, teamId: shift.teamId, at, by: CURRENT_USER, text: `Shift set: ${shift.member}, ${DAYS[shift.weekday]} ${shift.start}–${shift.end}.` }, ...s.teamLog],
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
          teamLog: [{ id: `TL-${at}-shx`, teamId: sh.teamId, at, by: CURRENT_USER, text: `Shift removed: ${sh.member} ${sh.start}–${sh.end}.` }, ...s.teamLog],
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
    sourceLabel: "Demo · Simulated data",
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
    insights,
    reassign,
    addNote,
    openCase,
    addCaseEntry,
    closeCase,
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
  if (!v) throw new Error("useDemo must be used inside DemoProvider");
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
        <p className="text-sm text-[var(--muted)]">Generating demo scenario…</p>
      </div>
    </div>
  );
}
