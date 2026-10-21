"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowRightLeft,
  ArrowUp,
  BellRing,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Gauge,
  History,
  MapPinned,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
  UserPlus,
  Users,
  Waves,
  X,
} from "lucide-react";
import { HABITAT, ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES, SPECIES_BY_ID } from "@/domain/species";
import type { CareTask, Shift, SpeciesId, TaskKind, TaskStatus } from "@/domain/types";
import { ALERT_TYPE_LABEL } from "@/logic/alertRules";
import { ALERT_STATUS_LABEL, PRIORITY_LABEL, PRIORITY_TONE, TASK_KIND_LABEL, TASK_STATUS_LABEL } from "@/logic/labels";
import { computeActivity, type Breakdown } from "@/logic/metrics";
import { STATUS_LABEL, type LiveStatus, type Snapshot } from "@/logic/status";
import { ALERT_FAMILY, ALERT_FAMILY_LABEL, isOpenTask, taskCompliance, taskPriority, taskUpdatedAt } from "@/logic/tasks";
import { DAY, HOUR, fmtAgo, fmtDate, fmtDateTime, fmtHours, fmtWeekday } from "@/logic/time";
import { PERMISSIONS, useDemo } from "@/state/DemoProvider";
import { Badge, Button, Card, Drawer, EmptyState, Select, SimulatedTag, cx } from "@/components/ui/primitives";
import { SERIES, StackedColumns } from "@/components/charts/Charts";
import { FilterMenu } from "@/components/filters/FilterMenu";
import { DayPicker, PeriodPicker } from "@/components/filters/PeriodPicker";
import { PenguinIllustration } from "@/components/penguin/PenguinIllustration";
import { StatusPill, STATUS_COLOR } from "@/components/penguin/StatusPill";
import { TaskStatusControl } from "@/features/alerts/TaskStatusControl";
import { SpeciesPenguinPanel } from "@/features/species/SpeciesPenguinPanel";
import { ActiveBadge, Avatars, TeamFormDrawer, initials, isActive } from "./shared";

type Tab = "resumen" | "pinguinos" | "tareas" | "alertas" | "horario" | "personal";
const TABS: { id: Tab; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "pinguinos", label: "Pingüinos" },
  { id: "tareas", label: "Tareas" },
  { id: "alertas", label: "Alertas" },
  { id: "horario", label: "Horario" },
  { id: "personal", label: "Personal" },
];
const GAP_COLOR = "rgba(245,184,75,0.8)";
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const AVAIL_LABEL: Record<Shift["availability"], string> = { available: "Disponible", partial: "Parcial", unavailable: "No disponible" };

type SortKey = "id" | "name" | "last" | "water" | "land" | "alerts";
type ActivityFilter = "water" | "land" | "nodata";
interface TableState {
  q: string;
  species: SpeciesId[];
  zones: string[];
  status: LiveStatus[];
  activity: ActivityFilter[];
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
  per: number;
}
const EMPTY_TABLE: TableState = { q: "", species: [], zones: [], status: [], activity: [], sort: "id", dir: "asc", page: 1, per: 10 };

export function TeamDetailView() {
  const { id } = useParams<{ id: string }>();
  const { dataset } = useDemo();
  const team = dataset.teams.find((t) => t.id === decodeURIComponent(id ?? ""));
  if (!team) {
    return (
      <div className="p-8">
        <Card>
          <EmptyState icon={SearchX} title={`No existe el equipo "${id}"`} action={<Link href="/teams" className="text-sm text-accent hover:underline">Volver a Care Teams</Link>} />
        </Card>
      </div>
    );
  }
  return <Detail key={team.id} teamId={team.id} />;
}

function Detail({ teamId }: { teamId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { dataset, teamOf, snapshots, tasks, alerts, range, now } = useDemo();
  const team = dataset.teams.find((t) => t.id === teamId)!;
  const tab = (TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "resumen") as Tab;
  const sel = params.get("sel");
  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const [table, setTable] = useState<TableState>(EMPTY_TABLE);
  const [editing, setEditing] = useState(false);

  const penguins = useMemo(() => dataset.penguins.filter((p) => teamOf(p.id) === teamId), [dataset, teamOf, teamId]);
  const ids = useMemo(() => penguins.map((p) => p.id), [penguins]);
  const agg = useMemo(() => computeActivity(dataset, ids, range.from, range.to), [dataset, ids, range]);
  const myTasks = useMemo(() => tasks.filter((t) => t.teamId === teamId), [tasks, teamId]);
  const myAlerts = useMemo(() => alerts.filter((a) => a.teamId === teamId), [alerts, teamId]);
  const openAlertsBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of alerts) if (a.penguinId && a.status !== "resolved") m.set(a.penguinId, (m.get(a.penguinId) ?? 0) + 1);
    return m;
  }, [alerts]);

  const recent = ids.filter((id) => {
    const s = snapshots.get(id)!;
    return s.recent && s.status !== "offline";
  }).length;
  const openTasks = myTasks.filter(isOpenTask);
  const activeAlerts = myAlerts.filter((a) => a.status !== "resolved");
  const compliance = taskCompliance(myTasks, range.from, range.to, now);
  const total = dataset.penguins.length;

  return (
    <div className="pb-10">
      {/* Encabezado */}
      <div className="px-6 pt-5 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/teams"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 pl-2.5 pr-4 text-sm font-medium text-ink transition hover:border-accent hover:bg-accent/20"
          >
            <ChevronLeft size={18} className="text-accent" /> Todos los equipos
          </Link>
          <nav className="flex items-center gap-1 text-xs text-muted">
            <Link href="/teams" className="hover:text-ink">Care Teams</Link>
            <ChevronRight size={12} className="text-faint" />
            <span className="text-ink">{team.name}</span>
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <PeriodPicker />
            <DayPicker />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: `${team.color}22`, color: team.color }}>
            <Users size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{team.name}</h1>
              <ActiveBadge team={team} />
              <SimulatedTag />
            </div>
            <p className="text-sm text-muted">
              {team.focus || "Sin descripción"} · {penguins.length} pingüinos asignados ({Math.round((penguins.length / Math.max(1, total)) * 100)}% del total)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Avatars team={team} max={4} size={34} />
            <div className="leading-tight">
              <p className="text-sm font-medium">{team.lead}</p>
              <p className="text-[11px] text-faint">Responsable · {team.members.length} integrantes</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 items-center gap-2 rounded-xl border border-line bg-black/20 px-3 text-xs text-muted">
              Equipo
              <select value={teamId} onChange={(e) => router.push(`/teams/${e.target.value}${tab !== "resumen" ? `?tab=${tab}` : ""}`)} className="bg-transparent text-xs text-ink outline-none">
                {dataset.teams.map((t) => (
                  <option key={t.id} value={t.id} className="bg-panel-solid">
                    {t.name}
                    {isActive(t) ? "" : " (inactivo)"}
                  </option>
                ))}
              </select>
            </label>
            {PERMISSIONS.manageTeams && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Editar equipo
              </Button>
            )}
            <Link href={`/map?team=${teamId}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-[#032a2a] hover:bg-[#5fe6d9]">
              <MapPinned size={15} /> Ver en el mapa
            </Link>
          </div>
        </div>
        {!isActive(team) && (
          <p className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            Equipo inactivo. Sus registros se conservan y sus pingüinos siguen asignados hasta que se reasignen de forma explícita.
          </p>
        )}
      </div>

      <div className="mt-4 space-y-4 px-6 lg:px-8">
        {/* Indicadores */}
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={Users} color={team.color} value={String(penguins.length)} label="Pingüinos asignados" sub={`${Math.round((penguins.length / Math.max(1, total)) * 100)}% del total`} />
          <Kpi icon={Waves} color="#2fd8c8" value={String(recent)} label="Con ubicación reciente" sub={penguins.length ? `${Math.round((recent / penguins.length) * 100)}%` : "Sin datos"} />
          <Kpi icon={Clock3} color="#f5b84b" value={String(penguins.length - recent)} label="Sin lectura reciente" sub="No implica un problema de salud" />
          <Kpi icon={ClipboardList} color="#f5b84b" value={String(openTasks.length)} label="Tareas pendientes" sub={`${openTasks.filter((t) => t.dueAt < now).length} vencidas`} />
          <Kpi icon={BellRing} color="#ff6b6b" value={String(activeAlerts.length)} label="Alertas activas" sub={`${activeAlerts.filter((a) => a.priority === "high").length} de prioridad alta`} />
          <Kpi
            icon={Gauge}
            color="#3ddc97"
            value={compliance.pct === null ? "Sin datos" : `${compliance.pct}%`}
            label="Cumplimiento de tareas"
            sub={compliance.total ? `${compliance.done} de ${compliance.total} que vencían en el periodo` : "Ninguna vencía en el periodo"}
          />
        </div>

        {/* Pestañas */}
        <div className="panel flex gap-1 overflow-x-auto p-1">
          {TABS.map((t) => {
            const count = t.id === "pinguinos" ? penguins.length : t.id === "tareas" ? openTasks.length : t.id === "alertas" ? activeAlerts.length : t.id === "personal" ? team.members.length : null;
            return (
              <button
                key={t.id}
                onClick={() => setParams({ tab: t.id === "resumen" ? null : t.id })}
                className={cx("flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-sm font-medium transition", tab === t.id ? "bg-accent/15 text-ink shadow-[inset_0_-2px_0_var(--accent)]" : "text-muted hover:bg-white/[0.04] hover:text-ink")}
              >
                {t.label}
                {count !== null && <span className="num rounded-md bg-white/[0.06] px-1.5 text-[11px] text-muted">{count}</span>}
              </button>
            );
          })}
        </div>

        {tab === "resumen" && (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <ZonePanel teamId={teamId} ids={ids} />
                <ActivityPanel agg={agg} label={range.label} span={range.to - range.from} />
              </div>
              <PenguinTable
                teamId={teamId}
                ids={ids}
                perPenguin={agg.perPenguin}
                openAlertsBy={openAlertsBy}
                state={table}
                setState={setTable}
                selected={null}
                onSelect={(id) => setParams({ tab: "pinguinos", sel: id })}
                compact
                rangeLabel={range.label}
              />
            </div>
            <div className="space-y-4">
              <TasksSide tasks={myTasks} onAll={() => setParams({ tab: "tareas" })} />
              <AlertsSide alerts={activeAlerts} onAll={() => setParams({ tab: "alertas" })} />
              <ScheduleSide teamId={teamId} onAll={() => setParams({ tab: "horario" })} />
            </div>
          </div>
        )}

        {tab === "pinguinos" && (
          <div className={cx("grid items-start gap-4", sel && ids.includes(sel) && "xl:grid-cols-[minmax(0,1fr)_350px]")}>
            <PenguinTable
              teamId={teamId}
              ids={ids}
              perPenguin={agg.perPenguin}
              openAlertsBy={openAlertsBy}
              state={table}
              setState={setTable}
              selected={sel}
              onSelect={(id) => setParams({ sel: sel === id ? null : id })}
              rangeLabel={range.label}
            />
            {sel && ids.includes(sel) && (
              <div className="space-y-3 xl:sticky xl:top-4">
                <SpeciesPenguinPanel key={sel} penguinId={sel} from={range.from} to={range.to} rangeLabel={range.label} onClose={() => setParams({ sel: null })} className="max-h-[calc(100vh-14rem)]" />
                <ReassignBox key={`r-${sel}`} penguinId={sel} onDone={() => setParams({ sel: null })} />
              </div>
            )}
          </div>
        )}

        {tab === "tareas" && <TasksTab teamId={teamId} ids={ids} />}
        {tab === "alertas" && <AlertsTab teamId={teamId} />}
        {tab === "horario" && <ScheduleTab teamId={teamId} />}
        {tab === "personal" && <StaffTab teamId={teamId} />}
      </div>

      <TeamFormDrawer open={editing} onClose={() => setEditing(false)} team={team} />
    </div>
  );
}

/* ───────────── Resumen ───────────── */

function ZonePanel({ teamId, ids }: { teamId: string; ids: string[] }) {
  const { snapshots } = useDemo();
  const rows = useMemo(() => {
    const m = new Map<string, { n: number; stale: number }>();
    let none = 0;
    for (const id of ids) {
      const s = snapshots.get(id)!;
      const z = s.reading?.zoneId;
      if (!z) {
        none++;
        continue;
      }
      const e = m.get(z) ?? { n: 0, stale: 0 };
      e.n++;
      if (s.status === "stale" || s.status === "offline") e.stale++;
      m.set(z, e);
    }
    return { list: [...m.entries()].sort((a, b) => b[1].n - a[1].n), none };
  }, [ids, snapshots]);
  const max = Math.max(1, ...rows.list.map(([, e]) => e.n));

  return (
    <Card title="Distribución por zona" subtitle="Última ubicación registrada · clic para abrir en el mapa">
      {rows.list.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">Sin datos de ubicación.</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.list.map(([z, e]) => (
            <li key={z}>
              <Link href={`/map?team=${teamId}&zone=${z}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-white/[0.04]">
                <span className="w-[118px] shrink-0 truncate text-[13px]">{ZONE_BY_ID[z].name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <span className="block h-full rounded-full bg-accent-2" style={{ width: `${(e.n / max) * 100}%` }} />
                </span>
                <span className="num w-6 text-right text-[13px] font-semibold">{e.n}</span>
                <span className="num w-9 text-right text-[11px] text-faint">{Math.round((e.n / ids.length) * 100)}%</span>
                <MapPinned size={12} className="text-faint" />
              </Link>
              {e.stale > 0 && <p className="-mt-1 pl-1.5 text-[10px] text-warn">{e.stale} con ubicación desactualizada</p>}
            </li>
          ))}
        </ul>
      )}
      {rows.none > 0 && <p className="mt-2 text-[11px] text-faint">{rows.none} sin ubicación registrada.</p>}
    </Card>
  );
}

function ActivityPanel({ agg, label, span }: { agg: ReturnType<typeof computeActivity>; label: string; span: number }) {
  const byHour = span <= 26 * HOUR;
  return (
    <Card title="Actividad del equipo" subtitle={`${label} · horas registradas de sus pingüinos`} action={<SimulatedTag />}>
      {agg.penguinCount === 0 ? (
        <p className="py-4 text-center text-xs text-muted">Sin pingüinos asignados.</p>
      ) : (
        <>
          <StackedColumns
            height={150}
            labelEvery={byHour ? 6 : agg.daily.length > 8 ? 2 : 1}
            format={fmtHours}
            series={[
              { key: "water", color: SERIES.water, label: "Agua" },
              { key: "land", color: SERIES.land, label: "Tierra" },
              { key: "gap", color: GAP_COLOR, label: "Sin lectura" },
            ]}
            data={
              byHour
                ? agg.hourly.map((h, i) => ({ label: `${i}h`, tooltip: `${String(i).padStart(2, "0")}:00`, values: { water: h.water, land: h.land, gap: h.noFix + h.noComm } }))
                : agg.daily.map((d) => ({ label: fmtDate(d.day).split(" ")[0], tooltip: fmtWeekday(d.day), values: { water: d.water, land: d.land, gap: d.noFix + d.noComm } }))
            }
          />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            <Dot color={SERIES.water}>Agua</Dot>
            <Dot color={SERIES.land}>Tierra</Dot>
            <Dot color={GAP_COLOR}>Sin lectura (no es inactividad)</Dot>
          </div>
        </>
      )}
    </Card>
  );
}

function TasksSide({ tasks, onAll }: { tasks: CareTask[]; onAll: () => void }) {
  const { now, dataset } = useDemo();
  const [filter, setFilter] = useState<"open" | "pending" | "in_progress">("open");
  const rows = tasks
    .filter((t) => (filter === "open" ? isOpenTask(t) : t.status === filter))
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, 6);
  return (
    <Card title={`Tareas del equipo (${tasks.filter(isOpenTask).length})`} icon={ClipboardList} action={<button onClick={onAll} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">Ver todas <ArrowRight size={12} /></button>}>
      <div className="-mt-1 mb-2 flex gap-1">
        {(
          [
            ["open", "Abiertas"],
            ["pending", "Pendientes"],
            ["in_progress", "En proceso"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cx("rounded-lg border px-2 py-0.5 text-[11px]", filter === k ? "border-accent/50 bg-accent/10 text-ink" : "border-line text-muted hover:text-ink")}>
            {l}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted">Sin tareas.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((t) => {
            const pr = taskPriority(t, now);
            const p = t.penguinId ? dataset.penguins.find((x) => x.id === t.penguinId) : undefined;
            return (
              <li key={t.id}>
                <Link href={`/alerts?tab=tasks&task=${t.id}`} className="flex items-start gap-2 rounded-lg px-1.5 py-1.5 hover:bg-white/[0.04]">
                  <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", pr === "high" ? "bg-danger" : pr === "medium" ? "bg-warn" : "bg-faint")} title={`Prioridad ${PRIORITY_LABEL[pr].toLowerCase()}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{t.title}</span>
                    <span className="block truncate text-[11px] text-faint">
                      {t.assignee ?? "Sin responsable"} · {p ? (p.name ?? p.id) : t.zoneId ? ZONE_BY_ID[t.zoneId]?.name : "—"}
                    </span>
                  </span>
                  <span className={cx("whitespace-nowrap text-[11px]", t.dueAt < now ? "text-danger" : "text-muted")}>{fmtDateTime(t.dueAt, now)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function AlertsSide({ alerts, onAll }: { alerts: ReturnType<typeof useDemo>["alerts"]; onAll: () => void }) {
  const { now, dataset } = useDemo();
  const rows = [...alerts].sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority] || b.createdAt - a.createdAt).slice(0, 5);
  return (
    <Card title={`Alertas del equipo (${alerts.length})`} icon={BellRing} action={<button onClick={onAll} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">Ver todas <ArrowRight size={12} /></button>}>
      {rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted">Sin alertas activas.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((a) => {
            const p = a.penguinId ? dataset.penguins.find((x) => x.id === a.penguinId) : undefined;
            return (
              <li key={a.id}>
                <Link href={`/alerts?alert=${a.id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-white/[0.04]">
                  <span className={cx("h-2 w-2 shrink-0 rounded-full", a.priority === "high" ? "bg-danger" : a.priority === "medium" ? "bg-warn" : "bg-faint")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{p ? `${p.id}${p.name ? ` · ${p.name}` : ""}` : "Sin ejemplar"}</span>
                    <span className="block truncate text-[11px] text-faint">{ALERT_FAMILY_LABEL[ALERT_FAMILY[a.type]]}</span>
                  </span>
                  <span className="whitespace-nowrap text-[11px] text-muted">{fmtAgo(a.createdAt, now)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ScheduleSide({ teamId, onAll }: { teamId: string; onAll: () => void }) {
  const { shifts, now } = useDemo();
  const weekday = new Date(now).getDay();
  const today = shifts.filter((s) => s.teamId === teamId && s.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start));
  return (
    <Card title="Horario del equipo (hoy)" icon={CalendarClock} action={<button onClick={onAll} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">Ver horario <ArrowRight size={12} /></button>}>
      {today.length === 0 ? (
        <div className="py-2 text-center">
          <p className="text-xs text-muted">{shifts.some((s) => s.teamId === teamId) ? "Sin turnos configurados para hoy." : "No hay turnos configurados para este equipo."}</p>
          {PERMISSIONS.manageTeams && (
            <button onClick={onAll} className="mt-2 text-xs text-accent hover:underline">
              Configurar turnos
            </button>
          )}
        </div>
      ) : (
        <ShiftTimeline shifts={today} compact />
      )}
    </Card>
  );
}

/* ───────────── Tabla de pingüinos ───────────── */

function PenguinTable({
  teamId,
  ids,
  perPenguin,
  openAlertsBy,
  state: t,
  setState,
  selected,
  onSelect,
  compact,
  rangeLabel,
}: {
  teamId: string;
  ids: string[];
  perPenguin: Map<string, Breakdown>;
  openAlertsBy: Map<string, number>;
  state: TableState;
  setState: (s: TableState) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  compact?: boolean;
  rangeLabel: string;
}) {
  const { dataset, snapshots, now } = useDemo();
  const set = (patch: Partial<TableState>) => setState({ ...t, page: "page" in patch ? patch.page! : 1, ...patch });

  type Row = { id: string; name?: string; species: SpeciesId; snap: Snapshot; b?: Breakdown; alerts: number; zone: string };
  const all: Row[] = useMemo(
    () =>
      ids.map((id) => {
        const p = dataset.penguins.find((x) => x.id === id)!;
        const snap = snapshots.get(id)!;
        return { id, name: p.name, species: p.speciesId, snap, b: perPenguin.get(id), alerts: openAlertsBy.get(id) ?? 0, zone: snap.reading?.zoneId ?? "" };
      }),
    [ids, dataset, snapshots, perPenguin, openAlertsBy],
  );
  const zoneOptions = [...new Set(all.map((r) => r.zone).filter(Boolean))].map((z) => ({ value: z, label: ZONE_BY_ID[z].name }));
  const speciesOptions = SPECIES.filter((s) => all.some((r) => r.species === s.id)).map((s) => ({ value: s.id, label: s.nameEs, color: s.color }));

  const rows = useMemo(() => {
    const q = t.q.trim().toLowerCase();
    const out = all.filter((r) => {
      const p = dataset.penguins.find((x) => x.id === r.id)!;
      if (q && ![r.id, r.name ?? "", p.deviceId].some((v) => v.toLowerCase().includes(q))) return false;
      if (t.species.length && !t.species.includes(r.species)) return false;
      if (t.zones.length && !t.zones.includes(r.zone)) return false;
      if (t.status.length && !t.status.includes(r.snap.status)) return false;
      if (t.activity.length) {
        const k: ActivityFilter = !r.b || r.b.readings === 0 ? "nodata" : r.b.water >= r.b.land ? "water" : "land";
        if (!t.activity.includes(k)) return false;
      }
      return true;
    });
    const val = (r: Row): number | string =>
      t.sort === "name" ? (r.name ?? "￿") : t.sort === "last" ? (r.snap.reading?.timestamp ?? 0) : t.sort === "water" ? (r.b?.water ?? -1) : t.sort === "land" ? (r.b?.land ?? -1) : t.sort === "alerts" ? r.alerts : r.id;
    const sign = t.dir === "desc" ? -1 : 1;
    out.sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * sign || a.id.localeCompare(b.id);
    });
    return out;
  }, [all, t, dataset]);

  const per = compact ? 8 : t.per;
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const page = Math.min(t.page, pages);
  const pageRows = rows.slice((page - 1) * per, page * per);
  const maxH = Math.max(1, ...rows.map((r) => Math.max(r.b?.water ?? 0, r.b?.land ?? 0)));
  const hasFilters = !!(t.q || t.species.length || t.zones.length || t.status.length || t.activity.length);
  const sortBy = (k: SortKey) => set({ sort: k, dir: t.sort === k && t.dir === "asc" ? "desc" : "asc" });

  return (
    <section className="panel min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        {compact && <h3 className="mr-2 text-[15px] font-semibold">Pingüinos del equipo <span className="num text-muted">({rows.length})</span></h3>}
        <div className="flex h-10 min-w-[200px] flex-[2] items-center gap-2 rounded-xl border border-line bg-black/20 px-3">
          <Search size={14} className="text-muted" />
          <input value={t.q} onChange={(e) => set({ q: e.target.value })} placeholder="Buscar por código, nombre o dispositivo…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
        </div>
        <FilterMenu<SpeciesId> className="flex-1" label="Especie" allLabel="Todas" value={t.species} onChange={(v) => set({ species: v })} options={speciesOptions} />
        <FilterMenu className="flex-1" label="Zona" allLabel="Todas" value={t.zones} onChange={(v) => set({ zones: v })} options={zoneOptions} />
        <FilterMenu<LiveStatus>
          className="flex-1"
          label="Estado"
          value={t.status}
          onChange={(v) => set({ status: v })}
          options={(["water", "land", "resting", "stale", "offline", "no_data"] as LiveStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s], color: STATUS_COLOR[s] }))}
        />
        {!compact && (
          <FilterMenu<ActivityFilter>
            className="flex-1"
            label="Actividad"
            allLabel="Todas"
            value={t.activity}
            onChange={(v) => set({ activity: v })}
            options={[
              { value: "water", label: "Más tiempo en agua", color: SERIES.water },
              { value: "land", label: "Más tiempo en tierra", color: SERIES.land },
              { value: "nodata", label: "Sin lecturas en el periodo", color: "#56718a" },
            ]}
          />
        )}
        {hasFilters && (
          <button onClick={() => setState({ ...EMPTY_TABLE, sort: t.sort, dir: t.dir, per: t.per })} className="inline-flex h-10 items-center gap-1 px-2 text-xs text-muted hover:text-ink">
            <X size={13} /> Limpiar
          </button>
        )}
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-muted">
              <th className="px-3 py-2.5 font-medium">Foto</th>
              <SortTh k="id" t={t} onSort={sortBy}>Código</SortTh>
              <SortTh k="name" t={t} onSort={sortBy}>Nombre</SortTh>
              <th className="px-2 py-2.5 font-medium">Especie</th>
              <th className="px-2 py-2.5 font-medium">Zona registrada</th>
              <th className="px-2 py-2.5 font-medium">Estado</th>
              <SortTh k="water" t={t} onSort={sortBy} sub={rangeLabel}>En agua</SortTh>
              <SortTh k="land" t={t} onSort={sortBy} sub={rangeLabel}>En tierra</SortTh>
              <SortTh k="last" t={t} onSort={sortBy}>Última lectura</SortTh>
              <SortTh k="alerts" t={t} onSort={sortBy}>Alertas</SortTh>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const stale = r.snap.status === "stale" || r.snap.status === "offline";
              const noData = !r.b || r.b.readings === 0;
              return (
                <tr
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  className={cx("cursor-pointer border-b border-line/70 transition last:border-0", selected === r.id ? "bg-accent/[0.08]" : "hover:bg-white/[0.025]")}
                >
                  <td className="px-3 py-1.5"><PenguinIllustration speciesId={r.species} size={32} /></td>
                  <td className="px-2 py-2 font-mono text-[13px]">{r.id}</td>
                  <td className="px-2 py-2">{r.name ?? <span className="text-faint">Sin nombre</span>}</td>
                  <td className="px-2 py-2 text-xs text-muted">{SPECIES_BY_ID[r.species].nameEs}</td>
                  <td className="px-2 py-2">
                    {r.zone ? (
                      <span className={cx("inline-flex rounded-md border px-1.5 py-0.5 text-xs", stale ? "border-warn/30 text-warn" : "border-line-strong")} title={stale ? "Última ubicación conocida, no actual" : undefined}>
                        {ZONE_BY_ID[r.zone].name}
                      </span>
                    ) : (
                      <span className="text-xs text-faint">Sin datos</span>
                    )}
                  </td>
                  <td className="px-2 py-2"><StatusPill status={r.snap.status} compact /></td>
                  <td className="px-2 py-2">{noData ? <span className="text-xs text-faint">Sin datos</span> : <HBar value={r.b!.water} max={maxH} color={SERIES.water} />}</td>
                  <td className="px-2 py-2">{noData ? <span className="text-xs text-faint">Sin datos</span> : <HBar value={r.b!.land} max={maxH} color="#f5b84b" />}</td>
                  <td className={cx("whitespace-nowrap px-2 py-2 text-xs", stale ? "text-warn" : "text-muted")}>{r.snap.reading ? fmtDateTime(r.snap.reading.timestamp, now) : "Sin datos"}</td>
                  <td className="px-2 py-2">
                    {r.alerts > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-danger/12 px-1.5 py-0.5 text-xs font-semibold text-danger"><BellRing size={11} /> {r.alerts}</span>
                    ) : (
                      <span className="text-faint">–</span>
                    )}
                  </td>
                  <td className="pr-3">
                    <Link href={`/penguins/${r.id}`} onClick={(e) => e.stopPropagation()} title="Abrir ficha" className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-white/5 hover:text-ink">
                      <ChevronRight size={15} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState icon={SearchX} title={ids.length ? "Ningún pingüino coincide" : "Este equipo no tiene pingüinos asignados"} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-muted">
        <span>
          Mostrando {rows.length ? (page - 1) * per + 1 : 0}–{Math.min(page * per, rows.length)} de {rows.length}
          {teamId && compact ? " · clic en un renglón para ver su resumen" : ""}
        </span>
        <div className="flex items-center gap-1">
          <PageBtn disabled={page <= 1} onClick={() => set({ page: page - 1 })}><ChevronLeft size={14} /></PageBtn>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <PageBtn key={n} active={n === page} onClick={() => set({ page: n })}>{n}</PageBtn>
          ))}
          <PageBtn disabled={page >= pages} onClick={() => set({ page: page + 1 })}><ChevronRight size={14} /></PageBtn>
        </div>
        {!compact && (
          <label className="flex items-center gap-2">
            Filas por página
            <select value={t.per} onChange={(e) => set({ per: Number(e.target.value) })} className="h-8 rounded-lg border border-line-strong bg-panel-solid px-2 text-xs text-ink">
              {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
    </section>
  );
}

function ReassignBox({ penguinId, onDone }: { penguinId: string; onDone: () => void }) {
  const { dataset, teamOf, reassign, penguinById } = useDemo();
  const from = dataset.teams.find((t) => t.id === teamOf(penguinId));
  const options = dataset.teams.filter((t) => t.id !== from?.id && isActive(t));
  const [target, setTarget] = useState("");
  const [confirming, setConfirming] = useState(false);
  const to = dataset.teams.find((t) => t.id === target);
  const p = penguinById.get(penguinId)!;

  if (!PERMISSIONS.reassignTeam) return null;
  return (
    <div className="panel p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium"><ArrowRightLeft size={13} className="text-accent" /> Reasignar a otro equipo</p>
      <Select
        value={target}
        onChange={(e) => {
          setTarget(e.target.value);
          setConfirming(false);
        }}
        className="h-8 w-full text-xs"
      >
        <option value="">Elegir equipo de destino…</option>
        {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
      {to && !confirming && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setConfirming(true)}>Revisar cambio</Button>
      )}
      {to && confirming && (
        <div className="mt-2 rounded-lg border border-accent/30 bg-accent/5 p-2.5 text-xs">
          <p>
            <span className="font-mono">{p.id}</span>{p.name ? ` · ${p.name}` : ""}
          </p>
          <p className="mt-1.5 flex items-center gap-2">
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5">{from?.name ?? "Sin asignar"}</span>
            <ArrowRight size={13} className="text-accent" />
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-ink">{to.name}</span>
          </p>
          <p className="mt-1.5 text-[11px] text-faint">Sus tareas y alertas abiertas pasan al nuevo equipo. Queda en el historial y se refleja en Species, Penguins y Habitat Map.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancelar</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                reassign(penguinId, to.id);
                onDone();
              }}
            >
              Confirmar reasignación
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── Tareas ───────────── */

function TasksTab({ teamId, ids }: { teamId: string; ids: string[] }) {
  const { tasks, dataset, now } = useDemo();
  const team = dataset.teams.find((t) => t.id === teamId)!;
  const [status, setStatus] = useState<"open" | TaskStatus | "all">("open");
  const [editing, setEditing] = useState<CareTask | "new" | null>(null);
  const rows = tasks
    .filter((t) => t.teamId === teamId && (status === "all" || (status === "open" ? isOpenTask(t) : t.status === status)))
    .sort((a, b) => Number(!isOpenTask(a)) - Number(!isOpenTask(b)) || a.dueAt - b.dueAt);
  const count = (s: "open" | TaskStatus | "all") => tasks.filter((t) => t.teamId === teamId && (s === "all" || (s === "open" ? isOpenTask(t) : t.status === s))).length;

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        {(
          [
            ["open", "Abiertas"],
            ["pending", "Pendientes"],
            ["in_progress", "En proceso"],
            ["done", "Completadas"],
            ["cancelled", "Canceladas"],
            ["all", "Todas"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={cx("h-8 rounded-xl border px-3 text-xs", status === k ? "border-accent/50 bg-accent/10 text-ink" : "border-line text-muted hover:text-ink")}>
            {l} <span className="num text-faint">{count(k)}</span>
          </button>
        ))}
        <span className="ml-auto text-[11px] text-faint">Se sincronizan con Alerts & Tasks. Prioridad según vencimiento.</span>
        {PERMISSIONS.manageTasks && (
          <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
            <Plus size={14} /> Nueva tarea
          </Button>
        )}
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-muted">
              <th className="px-3 py-2.5 font-medium">Prioridad</th>
              <th className="px-2 py-2.5 font-medium">Tarea</th>
              <th className="px-2 py-2.5 font-medium">Pingüino o zona</th>
              <th className="px-2 py-2.5 font-medium">Responsable</th>
              <th className="px-2 py-2.5 font-medium">Vencimiento</th>
              <th className="px-2 py-2.5 font-medium">Estado</th>
              <th className="px-2 py-2.5 font-medium">Última actualización</th>
              <th className="px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const pr = taskPriority(t, now);
              const p = t.penguinId ? dataset.penguins.find((x) => x.id === t.penguinId) : undefined;
              const last = t.history[t.history.length - 1];
              return (
                <tr key={t.id} className={cx("border-b border-line/70 last:border-0", !isOpenTask(t) && "opacity-70")}>
                  <td className="px-3 py-2">{isOpenTask(t) ? <Badge tone={PRIORITY_TONE[pr]}>{PRIORITY_LABEL[pr]}</Badge> : <span className="text-xs text-faint">—</span>}</td>
                  <td className="max-w-[300px] px-2 py-2">
                    <Link href={`/alerts?tab=tasks&task=${t.id}`} className="block truncate hover:underline">{t.title}</Link>
                    <span className="block truncate text-[11px] text-faint">{t.notes || TASK_KIND_LABEL[t.kind]} · {t.id}</span>
                  </td>
                  <td className="px-2 py-2 text-xs text-muted">{p ? <Link href={`/penguins/${p.id}`} className="hover:underline">{p.id}{p.name ? ` · ${p.name}` : ""}</Link> : t.zoneId ? ZONE_BY_ID[t.zoneId]?.name : "—"}</td>
                  <td className="px-2 py-2 text-xs">{t.assignee ?? <span className="text-faint">Sin responsable</span>}</td>
                  <td className={cx("whitespace-nowrap px-2 py-2 text-xs", isOpenTask(t) && t.dueAt < now ? "text-danger" : "text-muted")}>{fmtDateTime(t.dueAt, now)}</td>
                  <td className="px-2 py-2">{PERMISSIONS.manageTasks ? <TaskStatusControl task={t} /> : <Badge>{TASK_STATUS_LABEL[t.status]}</Badge>}</td>
                  <td className="px-2 py-2 text-[11px] text-muted">
                    {fmtAgo(taskUpdatedAt(t), now)}
                    {last && <span className="block max-w-[180px] truncate text-faint" title={last.text}>{last.by}: {last.text}</span>}
                  </td>
                  <td className="px-2 py-2">
                    {PERMISSIONS.manageTasks && (
                      <button onClick={() => setEditing(t)} className="rounded-lg p-1.5 text-faint hover:bg-white/5 hover:text-ink" title="Editar">
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-8 text-center text-xs text-muted">Sin tareas en este estado.</p>}
      </div>
      <Drawer open={!!editing} onClose={() => setEditing(null)} width={480} title={editing === "new" ? `Nueva tarea · ${team.name}` : editing ? `Editar ${editing.id}` : ""}>
        {editing && <TaskForm key={editing === "new" ? "new" : editing.id} teamId={teamId} ids={ids} task={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      </Drawer>
    </section>
  );
}

function TaskForm({ teamId, ids, task, onClose }: { teamId: string; ids: string[]; task?: CareTask; onClose: () => void }) {
  const { dataset, createTask, updateTask, setTaskStatus, now } = useDemo();
  const team = dataset.teams.find((t) => t.id === teamId)!;
  const toLocal = (ts: number) => {
    const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60_000);
    return d.toISOString().slice(0, 16);
  };
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? "observation_followup");
  const [assignee, setAssignee] = useState(task?.assignee ?? "");
  const [due, setDue] = useState(toLocal(task?.dueAt ?? now + DAY));
  const [penguinId, setPenguinId] = useState(task?.penguinId ?? "");
  const [zoneId, setZoneId] = useState(task?.zoneId ?? "");
  const field = "mt-1 w-full rounded-xl border border-line-strong bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent/60";

  const save = () => {
    const dueAt = new Date(due).getTime();
    if (task) updateTask(task.id, { title: title.trim(), notes: notes.trim(), assignee: assignee || undefined, dueAt, penguinId: penguinId || undefined, zoneId: zoneId || undefined });
    else createTask({ kind, title: title.trim(), teamId, dueAt, notes: notes.trim() || undefined, assignee: assignee || undefined, penguinId: penguinId || undefined, zoneId: zoneId || undefined });
    onClose();
  };

  return (
    <form className="space-y-4 p-5" onSubmit={(e) => (e.preventDefault(), title.trim() && save())}>
      {!task && (
        <label className="block text-xs text-muted">
          Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value as TaskKind)} className={field}>
            {(Object.keys(TASK_KIND_LABEL) as TaskKind[]).map((k) => <option key={k} value={k} className="bg-panel-solid">{TASK_KIND_LABEL[k]}</option>)}
          </select>
        </label>
      )}
      <label className="block text-xs text-muted">
        Nombre
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
      </label>
      <label className="block text-xs text-muted">
        Descripción
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={cx(field, "resize-none")} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">
          Responsable
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field}>
            <option value="" className="bg-panel-solid">Sin responsable</option>
            {team.members.map((m) => <option key={m} value={m} className="bg-panel-solid">{m}</option>)}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Vencimiento
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={cx(field, "[color-scheme:dark]")} />
        </label>
        <label className="block text-xs text-muted">
          Pingüino
          <select value={penguinId} onChange={(e) => setPenguinId(e.target.value)} className={field}>
            <option value="" className="bg-panel-solid">Ninguno</option>
            {ids.map((id) => {
              const p = dataset.penguins.find((x) => x.id === id)!;
              return <option key={id} value={id} className="bg-panel-solid">{id}{p.name ? ` · ${p.name}` : ""}</option>;
            })}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Zona
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={field}>
            <option value="" className="bg-panel-solid">Ninguna</option>
            {HABITAT.zones.filter((z) => z.kind !== "restricted").map((z) => <option key={z.id} value={z.id} className="bg-panel-solid">{z.name}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <div className="flex gap-2">
          {task && isOpenTask(task) && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => (setTaskStatus(task.id, "done"), onClose())}>Completar</Button>
              <Button type="button" size="sm" variant="danger" onClick={() => (setTaskStatus(task.id, "cancelled"), onClose())}>Cancelar tarea</Button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button type="submit" variant="primary" disabled={!title.trim()}>{task ? "Guardar" : "Crear tarea"}</Button>
        </div>
      </div>
    </form>
  );
}

/* ───────────── Alertas ───────────── */

function AlertsTab({ teamId }: { teamId: string }) {
  const { alerts, dataset, setAlertStatus, assignAlert, now } = useDemo();
  const [status, setStatus] = useState<"active" | "resolved" | "all">("active");
  const rows = alerts
    .filter((a) => a.teamId === teamId && (status === "all" || (status === "active") === (a.status !== "resolved")))
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority] || b.createdAt - a.createdAt);

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        {(
          [
            ["active", "Activas"],
            ["resolved", "Resueltas"],
            ["all", "Todas"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={cx("h-8 rounded-xl border px-3 text-xs", status === k ? "border-accent/50 bg-accent/10 text-ink" : "border-line text-muted hover:text-ink")}>
            {l}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-faint">Sincronizadas con Alerts & Tasks. Reglas automáticas; no son diagnósticos.</span>
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-muted">
              <th className="px-3 py-2.5 font-medium">Prioridad</th>
              <th className="px-2 py-2.5 font-medium">Tipo</th>
              <th className="px-2 py-2.5 font-medium">Ejemplar</th>
              <th className="px-2 py-2.5 font-medium">Fecha y hora</th>
              <th className="px-2 py-2.5 font-medium">Equipo responsable</th>
              <th className="px-2 py-2.5 font-medium">Estado</th>
              <th className="px-2 py-2.5 font-medium">Desde su creación</th>
              <th className="px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const p = a.penguinId ? dataset.penguins.find((x) => x.id === a.penguinId) : undefined;
              return (
                <tr key={a.id} className={cx("border-b border-line/70 last:border-0", a.status === "resolved" && "opacity-70")}>
                  <td className="px-3 py-2"><Badge tone={PRIORITY_TONE[a.priority]}>{PRIORITY_LABEL[a.priority]}</Badge></td>
                  <td className="px-2 py-2">
                    <span className="block text-[13px]">{ALERT_FAMILY_LABEL[ALERT_FAMILY[a.type]]}</span>
                    <span className="block text-[11px] text-faint">{ALERT_TYPE_LABEL[a.type]}</span>
                  </td>
                  <td className="px-2 py-2 text-xs">{p ? <Link href={`/penguins/${p.id}`} className="hover:underline">{p.id}{p.name ? ` · ${p.name}` : ""}</Link> : "—"}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-muted">{fmtDateTime(a.createdAt, now)}</td>
                  <td className="px-2 py-2">
                    {PERMISSIONS.manageAlerts && a.status !== "resolved" ? (
                      <Select value={a.teamId} onChange={(e) => assignAlert(a.id, e.target.value)} className="h-8 text-xs">
                        {dataset.teams.filter((t) => isActive(t) || t.id === a.teamId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </Select>
                    ) : (
                      <span className="text-xs text-muted">{dataset.teams.find((t) => t.id === a.teamId)?.name}</span>
                    )}
                  </td>
                  <td className="px-2 py-2"><Badge tone={a.status === "resolved" ? "ok" : a.status === "following" ? "info" : "warn"}>{ALERT_STATUS_LABEL[a.status]}</Badge></td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-muted">{fmtAgo(a.createdAt, now)}</td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-1.5">
                      <Link href={`/alerts?alert=${a.id}`} className="inline-flex h-8 items-center rounded-xl border border-line-strong px-2.5 text-xs hover:border-accent/50">Abrir</Link>
                      {PERMISSIONS.manageAlerts && a.status === "pending" && <Button size="sm" variant="outline" onClick={() => setAlertStatus(a.id, "following")}>Seguimiento</Button>}
                      {PERMISSIONS.manageAlerts && a.status !== "resolved" && <Button size="sm" variant="primary" onClick={() => setAlertStatus(a.id, "resolved")}>Resolver</Button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-8 text-center text-xs text-muted">Sin alertas en este estado.</p>}
      </div>
    </section>
  );
}

/* ───────────── Horario ───────────── */

function ShiftTimeline({ shifts, compact }: { shifts: Shift[]; compact?: boolean }) {
  const { dataset } = useDemo();
  const hours = compact ? [6, 12, 18] : [0, 3, 6, 9, 12, 15, 18, 21];
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  return (
    <div>
      <div className="relative ml-[120px] h-4 text-[10px] text-faint">
        {hours.map((h) => (
          <span key={h} className="absolute -translate-x-1/2" style={{ left: `${(h / 24) * 100}%` }}>{String(h).padStart(2, "0")}:00</span>
        ))}
      </div>
      <ul className="space-y-1.5">
        {shifts.map((s) => {
          const team = dataset.teams.find((t) => t.id === s.teamId)!;
          const a = toMin(s.start), b = toMin(s.end);
          const end = b > a ? b : 24 * 60;
          return (
            <li key={s.id} className="flex items-center gap-2">
              <span className="w-[112px] shrink-0 truncate text-xs" title={s.member}>{s.member}</span>
              <span className="relative h-6 flex-1 rounded-md bg-white/[0.03]">
                <span
                  className="absolute inset-y-0.5 grid place-items-center rounded-md text-[10px] font-medium text-[#03101c]"
                  style={{ left: `${(a / 1440) * 100}%`, width: `${((end - a) / 1440) * 100}%`, background: s.availability === "unavailable" ? "#56718a" : s.availability === "partial" ? "#f5b84b" : team.color }}
                >
                  {s.start}–{s.end}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScheduleTab({ teamId }: { teamId: string }) {
  const { dataset, shifts, addShift, removeShift, now } = useDemo();
  const team = dataset.teams.find((t) => t.id === teamId)!;
  const [weekday, setWeekday] = useState(new Date(now).getDay());
  const [showForm, setShowForm] = useState(false);
  const mine = shifts.filter((s) => s.teamId === teamId);
  const day = mine.filter((s) => s.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start));
  const turno = (start: string) => {
    const h = Number(start.split(":")[0]);
    return h < 12 ? "Mañana" : h < 18 ? "Tarde" : "Noche";
  };

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="panel p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setWeekday((weekday + 6) % 7)} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:text-ink"><ChevronLeft size={15} /></button>
          <p className="min-w-[110px] text-center text-sm font-semibold">{WEEKDAYS[weekday]}</p>
          <button onClick={() => setWeekday((weekday + 1) % 7)} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:text-ink"><ChevronRight size={15} /></button>
          {weekday !== new Date(now).getDay() && <button onClick={() => setWeekday(new Date(now).getDay())} className="text-xs text-accent hover:underline">Hoy</button>}
          {PERMISSIONS.manageTeams && (
            <Button size="sm" variant="primary" className="ml-auto" onClick={() => setShowForm(true)}><Plus size={14} /> Configurar turno</Button>
          )}
        </div>
        {mine.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No hay turnos configurados" action={PERMISSIONS.manageTeams ? <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>Configurar turnos</Button> : undefined}>
            La demo no incluye horarios del personal y no se inventan. Cuando se registren, aparecerán aquí por día.
          </EmptyState>
        ) : day.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">Sin turnos configurados para el {WEEKDAYS[weekday].toLowerCase()}.</p>
        ) : (
          <>
            <ShiftTimeline shifts={day} />
            <table className="mt-5 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted">
                  <th className="py-2 font-medium">Nombre</th>
                  <th className="py-2 font-medium">Rol</th>
                  <th className="py-2 font-medium">Turno</th>
                  <th className="py-2 font-medium">Inicio</th>
                  <th className="py-2 font-medium">Fin</th>
                  <th className="py-2 font-medium">Disponibilidad</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {day.map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0">
                    <td className="py-2">{s.member}</td>
                    <td className="py-2 text-xs text-muted">{s.member === team.lead ? "Responsable" : team.roles?.[s.member] || "Sin rol registrado"}</td>
                    <td className="py-2 text-xs">{turno(s.start)}</td>
                    <td className="py-2 font-mono text-xs">{s.start}</td>
                    <td className="py-2 font-mono text-xs">{s.end}</td>
                    <td className="py-2"><Badge tone={s.availability === "available" ? "ok" : s.availability === "partial" ? "warn" : "neutral"}>{AVAIL_LABEL[s.availability]}</Badge></td>
                    <td className="py-2 text-right">
                      {PERMISSIONS.manageTeams && (
                        <button onClick={() => removeShift(s.id)} className="rounded-lg p-1.5 text-faint hover:bg-white/5 hover:text-danger" title="Retirar turno"><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
      {showForm && PERMISSIONS.manageTeams ? (
        <ShiftForm team={team} weekday={weekday} onAdd={(s) => addShift(s)} onClose={() => setShowForm(false)} />
      ) : (
        <Card title="Semana" icon={CalendarClock} subtitle="Turnos configurados por día">
          <ul className="space-y-1">
            {WEEKDAYS.map((d, i) => {
              const n = mine.filter((s) => s.weekday === i).length;
              return (
                <li key={d}>
                  <button onClick={() => setWeekday(i)} className={cx("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm", i === weekday ? "bg-accent/10 text-ink" : "text-muted hover:bg-white/[0.04]")}>
                    {d}
                    <span className="num text-xs text-faint">{n ? `${n} turno${n === 1 ? "" : "s"}` : "—"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ShiftForm({ team, weekday, onAdd, onClose }: { team: ReturnType<typeof useDemo>["dataset"]["teams"][number]; weekday: number; onAdd: (s: Omit<Shift, "id">) => void; onClose: () => void }) {
  const [member, setMember] = useState(team.members[0] ?? "");
  const [day, setDay] = useState(weekday);
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("15:00");
  const [availability, setAvailability] = useState<Shift["availability"]>("available");
  const [saved, setSaved] = useState(false);
  const field = "mt-1 w-full rounded-xl border border-line-strong bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent/60 [color-scheme:dark]";
  return (
    <Card title="Configurar turno" icon={CalendarClock} action={<button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-ink"><X size={15} /></button>}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd({ teamId: team.id, member, weekday: day, start, end, availability });
          setSaved(true);
        }}
      >
        <label className="block text-xs text-muted">
          Integrante
          <select value={member} onChange={(e) => (setMember(e.target.value), setSaved(false))} className={field}>
            {team.members.map((m) => <option key={m} value={m} className="bg-panel-solid">{m}</option>)}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Día
          <select value={day} onChange={(e) => (setDay(Number(e.target.value)), setSaved(false))} className={field}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i} className="bg-panel-solid">{d}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-muted">
            Inicio
            <input type="time" value={start} onChange={(e) => (setStart(e.target.value), setSaved(false))} className={field} />
          </label>
          <label className="block text-xs text-muted">
            Fin
            <input type="time" value={end} onChange={(e) => (setEnd(e.target.value), setSaved(false))} className={field} />
          </label>
        </div>
        <label className="block text-xs text-muted">
          Disponibilidad
          <select value={availability} onChange={(e) => setAvailability(e.target.value as Shift["availability"])} className={field}>
            {(Object.keys(AVAIL_LABEL) as Shift["availability"][]).map((k) => <option key={k} value={k} className="bg-panel-solid">{AVAIL_LABEL[k]}</option>)}
          </select>
        </label>
        <div className="flex items-center justify-between">
          {saved ? <span className="text-xs text-ok">Turno guardado.</span> : <span />}
          <Button type="submit" variant="primary" size="sm" disabled={!member || start >= end}>Guardar turno</Button>
        </div>
        {start >= end && <p className="text-[11px] text-danger">La hora de fin debe ser posterior al inicio.</p>}
      </form>
    </Card>
  );
}

/* ───────────── Personal ───────────── */

function StaffTab({ teamId }: { teamId: string }) {
  const { dataset, tasks, shifts, teamLog, updateTeam, now } = useDemo();
  const team = dataset.teams.find((t) => t.id === teamId)!;
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const history = teamLog.filter((l) => l.teamId === teamId);
  const can = PERMISSIONS.manageTeams;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="panel overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] text-muted">
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-2 py-2.5 font-medium">Rol</th>
                <th className="px-2 py-2.5 font-medium">Asignación</th>
                <th className="px-2 py-2.5 font-medium">Turno configurado</th>
                <th className="px-2 py-2.5 font-medium">Tareas asignadas</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {team.members.map((m) => {
                const isLead = m === team.lead;
                const myShifts = shifts.filter((s) => s.teamId === teamId && s.member === m);
                const myTasks = tasks.filter((t) => t.teamId === teamId && t.assignee === m && isOpenTask(t)).length;
                return (
                  <tr key={m} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold text-[#03101c]" style={{ background: team.color }}>{initials(m)}</span>
                        {m}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {isLead ? (
                        <Badge tone="accent">Responsable</Badge>
                      ) : can ? (
                        <input
                          defaultValue={team.roles?.[m] ?? ""}
                          placeholder="Sin rol registrado"
                          onBlur={(e) => e.target.value.trim() !== (team.roles?.[m] ?? "") && updateTeam(teamId, { roles: { ...team.roles, [m]: e.target.value.trim() } })}
                          className="h-8 w-44 rounded-lg border border-line bg-black/20 px-2 text-xs outline-none placeholder:text-faint focus:border-accent/60"
                        />
                      ) : (
                        <span className="text-xs text-muted">{team.roles?.[m] || "Sin rol registrado"}</span>
                      )}
                    </td>
                    <td className="px-2 py-2"><Badge tone="ok">Activo en el equipo</Badge></td>
                    <td className="px-2 py-2 text-xs text-muted">
                      {myShifts.length ? myShifts.map((s) => `${WEEKDAYS[s.weekday].slice(0, 3)} ${s.start}–${s.end}`).join(" · ") : <span className="text-faint">Sin turno configurado</span>}
                    </td>
                    <td className="num px-2 py-2 text-xs">{myTasks || <span className="text-faint">0</span>}</td>
                    <td className="px-2 py-2 text-right">
                      {can && !isLead &&
                        (removing === m ? (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            ¿Retirar?
                            <Button size="sm" variant="danger" onClick={() => (updateTeam(teamId, { members: team.members.filter((x) => x !== m) }), setRemoving(null))}>Sí</Button>
                            <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>No</Button>
                          </span>
                        ) : (
                          <button onClick={() => setRemoving(m)} className="rounded-lg p-1.5 text-faint hover:bg-white/5 hover:text-danger" title="Retirar del equipo"><Trash2 size={14} /></button>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {can && (
          <form
            className="flex flex-wrap items-end gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const n = newName.trim();
              if (!n || team.members.includes(n)) return;
              updateTeam(teamId, { members: [...team.members, n], ...(newRole.trim() ? { roles: { ...team.roles, [n]: newRole.trim() } } : {}) });
              setNewName("");
              setNewRole("");
            }}
          >
            <label className="text-xs text-muted">
              Nuevo integrante
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre y apellido" className="mt-1 block h-9 w-56 rounded-xl border border-line-strong bg-black/20 px-3 text-sm outline-none focus:border-accent/60" />
            </label>
            <label className="text-xs text-muted">
              Rol
              <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Opcional" className="mt-1 block h-9 w-44 rounded-xl border border-line-strong bg-black/20 px-3 text-sm outline-none focus:border-accent/60" />
            </label>
            <Button type="submit" variant="primary" disabled={!newName.trim() || team.members.includes(newName.trim())}>
              <UserPlus size={14} /> Agregar
            </Button>
            <span className="text-[11px] text-faint">El responsable se cambia desde «Editar equipo».</span>
          </form>
        )}
      </section>
      <Card title="Historial del equipo" icon={History} subtitle="Cambios de composición, roles, estado y turnos">
        {history.length === 0 ? (
          <p className="py-3 text-xs text-muted">Sin cambios registrados en la demo.</p>
        ) : (
          <ol className="scroll-thin max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
            {history.map((h) => (
              <li key={h.id} className="text-xs">
                <p>{h.text}</p>
                <p className="text-[11px] text-faint">{h.by} · {fmtDateTime(h.at, now)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

/* ───────────── auxiliares ───────────── */

function Kpi({ icon: Icon, color, value, label, sub }: { icon: typeof Users; color: string; value: string; label: string; sub?: string }) {
  return (
    <div className="panel flex items-center gap-3 px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: `${color}1f`, color }}>
        <Icon size={19} />
      </span>
      <div className="min-w-0">
        <p className="num text-xl font-semibold leading-tight">{value}</p>
        <p className="truncate text-xs text-muted">{label}</p>
        {sub && <p className="truncate text-[10px] text-faint" title={sub}>{sub}</p>}
      </div>
    </div>
  );
}

function SortTh({ k, t, onSort, sub, children }: { k: SortKey; t: { sort: SortKey; dir: "asc" | "desc" }; onSort: (k: SortKey) => void; sub?: string; children: ReactNode }) {
  const on = t.sort === k;
  return (
    <th className="px-2 py-2.5 font-medium">
      <button onClick={() => onSort(k)} className={cx("inline-flex items-start gap-1 text-left hover:text-ink", on && "text-ink")}>
        <span>
          {children}
          {sub && <span className="block text-[10px] font-normal text-faint">{sub}</span>}
        </span>
        {on && (t.dir === "asc" ? <ArrowUp size={11} className="mt-0.5" /> : <ArrowDown size={11} className="mt-0.5" />)}
      </button>
    </th>
  );
}

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-14 overflow-hidden rounded-full bg-white/[0.05]">
        <span className="block h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
      <span className="num w-11 text-xs">{fmtHours(value)}</span>
    </span>
  );
}

function PageBtn({ children, active, disabled, onClick }: { children: ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cx("grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs transition disabled:opacity-30", active ? "border border-accent/50 bg-accent/10 text-ink" : "text-muted hover:bg-white/5 hover:text-ink")}
    >
      {children}
    </button>
  );
}

function Dot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

