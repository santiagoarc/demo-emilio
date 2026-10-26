"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, BellRing, ChevronRight, ClipboardList, Gauge, MapPinned, Plus, Search, Users, Waves } from "lucide-react";
import { ZONE_BY_ID } from "@/domain/habitat";
import { ALERT_TYPE_LABEL } from "@/logic/alertRules";
import { ALERT_STATUS_LABEL, PRIORITY_LABEL, PRIORITY_TONE, TASK_STATUS_LABEL } from "@/logic/labels";
import { computeActivity } from "@/logic/metrics";
import { ALERT_FAMILY, ALERT_FAMILY_LABEL, isOpenTask, taskCompliance, taskPriority } from "@/logic/tasks";
import { fmtAgo, fmtDate, fmtDateTime, fmtHours, fmtWeekday } from "@/logic/time";
import { PERMISSIONS, useDemo } from "@/state/DemoProvider";
import { Badge, Card, Segmented, SimulatedTag, cx } from "@/components/ui/primitives";
import { Donut, SERIES, StackedColumns } from "@/components/charts/Charts";
import { DayPicker, PeriodPicker } from "@/components/filters/PeriodPicker";
import { ActiveBadge, Avatars, TeamFormDrawer, isActive, useTeamStats, type TeamStats } from "./shared";

type SortKey = "name" | "penguins" | "tasks" | "alerts" | "status";
type StatusFilter = "all" | "active" | "inactive";
const GAP_COLOR = "rgba(245,184,75,0.8)";

export function TeamsView() {
  const router = useRouter();
  const { dataset, snapshots, teamOf, tasks, alerts, range, now } = useDemo();
  const stats = useTeamStats();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("penguins");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);

  const total = dataset.penguins.length;
  const assignedIds = useMemo(() => dataset.penguins.filter((p) => dataset.teams.some((t) => t.id === teamOf(p.id))).map((p) => p.id), [dataset, teamOf]);
  const recent = assignedIds.filter((id) => {
    const s = snapshots.get(id)!;
    return s.recent && s.status !== "offline";
  }).length;
  const openTasks = tasks.filter(isOpenTask);
  const openAlerts = alerts.filter((a) => a.status !== "resolved");
  const compliance = taskCompliance(tasks, range.from, range.to, now);
  const activeCount = dataset.teams.filter(isActive).length;

  const cards = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = stats.filter(
      (x) =>
        (statusFilter === "all" || (statusFilter === "active") === isActive(x.team)) &&
        (!s || [x.team.name, x.team.lead, ...x.team.members].some((v) => v.toLowerCase().includes(s))),
    );
    const by: Record<SortKey, (a: TeamStats, b: TeamStats) => number> = {
      name: (a, b) => a.team.name.localeCompare(b.team.name),
      penguins: (a, b) => b.penguinIds.length - a.penguinIds.length,
      tasks: (a, b) => b.openTasks - a.openTasks,
      alerts: (a, b) => b.openAlerts - a.openAlerts,
      status: (a, b) => Number(!isActive(a.team)) - Number(!isActive(b.team)),
    };
    return [...list].sort((a, b) => by[sort](a, b) || a.team.name.localeCompare(b.team.name));
  }, [stats, q, sort, statusFilter]);

  // Distribución por zona: última ubicación registrada de todos los ejemplares.
  const zoneRows = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of dataset.penguins) {
      const z = snapshots.get(p.id)?.reading?.zoneId;
      if (z) m.set(z, (m.get(z) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [dataset, snapshots]);

  const agg = useMemo(() => computeActivity(dataset, assignedIds, range.from, range.to), [dataset, assignedIds, range]);
  const span = range.to - range.from;
  const byHour = span <= 26 * 3_600_000;

  const upcoming = [...openTasks]
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[taskPriority(a, now)] - order[taskPriority(b, now)] || a.dueAt - b.dueAt;
    })
    .slice(0, 6);
  const recentAlerts = [...openAlerts]
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority] || b.createdAt - a.createdAt;
    })
    .slice(0, 6);
  const teamById = (id: string) => dataset.teams.find((t) => t.id === id);
  const alertTarget = (a: (typeof alerts)[number]) => {
    if (a.penguinId) return penguinLabel(a.penguinId);
    const t = a.taskId ? tasks.find((x) => x.id === a.taskId) : undefined;
    if (t?.penguinId) return penguinLabel(t.penguinId);
    if (t?.zoneId) return ZONE_BY_ID[t.zoneId]?.name ?? "—";
    return t ? t.title : "—";
  };
  function penguinLabel(id: string) {
    const p = dataset.penguins.find((x) => x.id === id);
    return p?.name ? `${id} · ${p.name}` : id;
  }

  return (
    <div className="pb-10">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-6 lg:px-8">
        <div className="min-w-0">
          <p className="eyebrow mb-1">Care Teams · SeaWorld Penguin Tracking & Care</p>
          <h1 className="text-[28px] font-semibold tracking-tight">Equipos de cuidado</h1>
          <p className="mt-1 text-sm text-muted">Gestión de equipos, pingüinos asignados, tareas y desempeño operativo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker />
          <DayPicker />
          {PERMISSIONS.manageTeams && (
            <button onClick={() => setCreating(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white hover:bg-[#0b8178]">
              <Plus size={16} /> Nuevo equipo
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5 px-6 lg:px-8">
        {/* Indicadores */}
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={Users} color="#a78bfa" value={String(dataset.teams.length)} label="Equipos de cuidado" sub={`${activeCount} activos · ${dataset.teams.length - activeCount} inactivos`} />
          <Kpi icon={Users} color="#5cb8ff" value={String(assignedIds.length)} label="Pingüinos asignados" sub={`${Math.round((assignedIds.length / Math.max(1, total)) * 100)}% del total · un equipo por ejemplar`} />
          <Kpi icon={Waves} color="#2fd8c8" value={`${Math.round((recent / Math.max(1, assignedIds.length)) * 100)}%`} label="Con ubicación reciente" sub={`${recent} de ${assignedIds.length} · asignación actual`} />
          <Kpi icon={ClipboardList} color="#f5b84b" value={String(openTasks.length)} label="Tareas pendientes" sub={`${openTasks.filter((t) => t.dueAt < now).length} vencidas`} subTone="warn" />
          <Kpi icon={BellRing} color="#ff6b6b" value={String(openAlerts.length)} label="Alertas activas" sub={`${openAlerts.filter((a) => a.priority === "high").length} de prioridad alta`} subTone="danger" />
          <Kpi
            icon={Gauge}
            color="#3ddc97"
            value={compliance.pct === null ? "Sin datos" : `${compliance.pct}%`}
            label="Cumplimiento de tareas"
            sub={compliance.total ? `${compliance.done} de ${compliance.total} con vencimiento en el periodo` : "Sin tareas que vencieran en el periodo"}
          />
        </div>

        {/* Equipos */}
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight">Equipos de cuidado</h2>
              <p className="text-xs text-muted">Selecciona un equipo para ver su información detallada. Nombres configurables, no representan la estructura real.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 w-[220px] items-center gap-2 rounded-xl border border-line bg-ink/[0.05] px-3">
                <Search size={14} className="text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar equipo o responsable…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
              </div>
              <Segmented<StatusFilter>
                size="sm"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "Todos" },
                  { value: "active", label: "Activos" },
                  { value: "inactive", label: "Inactivos" },
                ]}
              />
              <label className="flex h-9 items-center gap-2 rounded-xl border border-line bg-ink/[0.05] px-3 text-xs text-muted">
                Ordenar por
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="bg-transparent text-xs text-ink outline-none">
                  <option value="penguins">Pingüinos asignados</option>
                  <option value="name">Nombre</option>
                  <option value="tasks">Tareas pendientes</option>
                  <option value="alerts">Alertas</option>
                  <option value="status">Estado</option>
                </select>
              </label>
            </div>
          </div>
          {cards.length === 0 ? (
            <p className="panel px-4 py-8 text-center text-sm text-muted">Ningún equipo coincide con la búsqueda.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {cards.map((x) => (
                <TeamCard key={x.team.id} x={x} total={total} onOpen={() => router.push(`/teams/${x.team.id}`)} />
              ))}
            </div>
          )}
        </section>

        {/* Analítica */}
        <div className="grid gap-5 xl:grid-cols-3">
          <Card title="Distribución de pingüinos por equipo" subtitle="Asignación actual · clic para abrir el equipo">
            <div className="flex flex-wrap items-center gap-5">
              <Donut
                size={136}
                thickness={16}
                parts={stats.map((x) => ({ value: x.penguinIds.length, color: x.team.color, label: x.team.name }))}
                center={
                  <div>
                    <p className="num text-2xl font-semibold leading-none">{assignedIds.length}</p>
                    <p className="text-[10px] text-faint">asignados</p>
                  </div>
                }
              />
              <ul className="min-w-[180px] flex-1 space-y-1">
                {[...stats].sort((a, b) => b.penguinIds.length - a.penguinIds.length).map((x) => (
                  <li key={x.team.id}>
                    <Link href={`/teams/${x.team.id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-ink/[0.04]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.team.color }} />
                      <span className="flex-1 truncate">{x.team.name}</span>
                      <span className="num font-semibold">{x.penguinIds.length}</span>
                      <span className="num w-10 text-right text-xs text-faint">{Math.round((x.penguinIds.length / Math.max(1, total)) * 100)}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card title="Distribución por zona" subtitle="Última ubicación registrada · todos los equipos · clic para abrir el mapa">
            <ul className="space-y-0.5">
              {zoneRows.slice(0, 7).map(([z, n]) => {
                const pct = Math.round((n / Math.max(1, total)) * 100);
                return (
                  <li key={z}>
                    <Link href={`/map?zone=${z}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-ink/[0.04]">
                      <span className="w-[112px] shrink-0 truncate text-[13px]">{ZONE_BY_ID[z].name}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.05]">
                        <span className="block h-full rounded-full bg-accent-2" style={{ width: `${(n / zoneRows[0][1]) * 100}%` }} />
                      </span>
                      <span className="num w-7 text-right text-[13px] font-semibold">{n}</span>
                      <span className="num w-9 text-right text-[11px] text-faint">{pct}%</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {zoneRows.length > 7 && <p className="mt-1 px-1.5 text-[11px] text-faint">+{zoneRows.length - 7} zonas más en Habitat Map</p>}
          </Card>

          <Card title="Actividad general de los equipos" subtitle={`${range.label} · horas registradas, suma de ejemplares asignados`} action={<SimulatedTag />}>
            <StackedColumns
              height={142}
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
          </Card>
        </div>

        {/* Tareas y alertas */}
        <div className="grid gap-5 xl:grid-cols-2">
          <Card
            title="Tareas próximas"
            subtitle="Todos los equipos · prioridad según vencimiento"
            action={<Link href="/alerts?tab=tasks" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">Ver todas <ArrowRight size={12} /></Link>}
          >
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-muted">
                    <th className="pb-2 font-medium">Prioridad</th>
                    <th className="pb-2 font-medium">Tarea</th>
                    <th className="pb-2 font-medium">Equipo</th>
                    <th className="pb-2 font-medium">Pingüino o zona</th>
                    <th className="pb-2 font-medium">Vence</th>
                    <th className="pb-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((t) => {
                    const pr = taskPriority(t, now);
                    return (
                      <tr key={t.id} onClick={() => router.push(`/alerts?tab=tasks&task=${t.id}`)} className="cursor-pointer border-t border-line/70 hover:bg-ink/[0.03]">
                        <td className="py-2"><Badge tone={PRIORITY_TONE[pr]}>{PRIORITY_LABEL[pr]}</Badge></td>
                        <td className="max-w-[200px] truncate py-2 pr-2">{t.title}</td>
                        <td className="py-2 pr-2 text-xs text-muted">{teamById(t.teamId)?.name ?? "Sin asignar"}</td>
                        <td className="py-2 pr-2 text-xs text-muted">{t.penguinId ? penguinLabel(t.penguinId) : t.zoneId ? ZONE_BY_ID[t.zoneId]?.name : "—"}</td>
                        <td className={cx("whitespace-nowrap py-2 pr-2 text-xs", t.dueAt < now ? "text-danger" : "text-muted")}>{fmtDateTime(t.dueAt, now)}</td>
                        <td className="py-2"><Badge tone={t.status === "in_progress" ? "info" : "warn"}>{TASK_STATUS_LABEL[t.status]}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {upcoming.length === 0 && <p className="py-4 text-center text-xs text-muted">Sin tareas pendientes.</p>}
            </div>
          </Card>

          <Card
            title="Alertas recientes"
            subtitle="Activas, primero las de prioridad alta"
            action={<Link href="/alerts" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">Ver todas <ArrowRight size={12} /></Link>}
          >
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-muted">
                    <th className="pb-2 font-medium">Pingüino o zona</th>
                    <th className="pb-2 font-medium">Equipo</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Tiempo</th>
                    <th className="pb-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAlerts.map((a) => (
                    <tr key={a.id} onClick={() => router.push(`/alerts?alert=${a.id}`)} className="cursor-pointer border-t border-line/70 hover:bg-ink/[0.03]">
                      <td className="py-2 pr-2">
                        <span className="inline-flex items-center gap-2">
                          <span className={cx("h-2 w-2 rounded-full", a.priority === "high" ? "bg-danger" : a.priority === "medium" ? "bg-warn" : "bg-faint")} />
                          <span className="text-xs">{alertTarget(a)}</span>
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-xs text-muted">{teamById(a.teamId)?.name ?? "Sin asignar"}</td>
                      <td className="py-2 pr-2 text-xs">
                        <span className="block">{ALERT_FAMILY_LABEL[ALERT_FAMILY[a.type]]}</span>
                        <span className="block text-[10px] text-faint">{ALERT_TYPE_LABEL[a.type]}</span>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-2 text-xs text-muted">{fmtAgo(a.createdAt, now)}</td>
                      <td className="py-2"><Badge tone={a.status === "following" ? "info" : "warn"}>{ALERT_STATUS_LABEL[a.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentAlerts.length === 0 && <p className="py-4 text-center text-xs text-muted">Sin alertas activas.</p>}
            </div>
            <p className="mt-2 text-[10px] text-faint">Las alertas salen de reglas configurables; no son diagnósticos veterinarios.</p>
          </Card>
        </div>
      </div>

      <TeamFormDrawer open={creating} onClose={() => setCreating(false)} onSaved={(id) => router.push(`/teams/${id}`)} />
    </div>
  );
}

function TeamCard({ x, total, onOpen }: { x: TeamStats; total: number; onOpen: () => void }) {
  const { team } = x;
  const pct = Math.round((x.penguinIds.length / Math.max(1, total)) * 100);
  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={cx("panel group relative flex cursor-pointer flex-col overflow-hidden p-4 transition hover:!border-accent/50 focus-visible:!border-accent focus-visible:outline-none", !isActive(team) && "opacity-75")}
    >
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: team.color }} />
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${team.color}22`, color: team.color }}>
          <Users size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold">{team.name}</p>
          <ActiveBadge team={team} />
        </div>
        <ChevronRight size={18} className="mt-1 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Avatars team={team} max={4} size={28} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm">{team.lead}</p>
          <p className="text-[11px] text-faint">Responsable · {team.members.length} integrantes</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted">Pingüinos asignados</span>
          <span>
            <b className="num text-sm">{x.penguinIds.length}</b> <span className="text-faint">· {pct}% del total</span>
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: team.color }} />
        </div>
      </div>
      <p className="mt-3 truncate text-[11px] text-muted" title={team.zoneIds.map((z) => ZONE_BY_ID[z]?.name).join(", ")}>
        <span className="text-faint">Zonas: </span>
        {team.zoneIds.length ? team.zoneIds.slice(0, 3).map((z) => ZONE_BY_ID[z]?.name).join(", ") : "Sin zonas asignadas"}
        {team.zoneIds.length > 3 && ` +${team.zoneIds.length - 3}`}
      </p>
      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-xs">
        <span className={cx("inline-flex items-center gap-1", x.openAlerts ? "text-danger" : "text-faint")}>
          <BellRing size={13} /> {x.openAlerts} alertas
        </span>
        <span className={cx("inline-flex items-center gap-1", x.openTasks ? "text-warn" : "text-faint")}>
          <ClipboardList size={13} /> {x.openTasks} tareas
        </span>
        <Link
          href={`/map?team=${team.id}`}
          onClick={(e) => e.stopPropagation()}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-line-strong px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-ink"
        >
          <MapPinned size={12} /> Ver en el mapa
        </Link>
      </div>
    </article>
  );
}

function Kpi({ icon: Icon, color, value, label, sub, subTone }: { icon: typeof Users; color: string; value: string; label: string; sub?: string; subTone?: "warn" | "danger" }) {
  return (
    <div className="panel flex items-center gap-3 px-4 py-3.5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${color}1f`, color }}>
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="num text-xl font-semibold leading-tight">{value}</p>
        <p className="truncate text-xs text-muted">{label}</p>
        {sub && <p className={cx("truncate text-[10px]", subTone === "warn" ? "text-warn" : subTone === "danger" ? "text-danger" : "text-faint")} title={sub}>{sub}</p>}
      </div>
    </div>
  );
}

function Dot({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}
