"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, MapPinned, Plus, Search, Users, Waves } from "lucide-react";
import { ZONE_BY_ID } from "@/domain/habitat";
import { computeActivity } from "@/logic/metrics";
import { fmtHours, fmtWeekday } from "@/logic/time";
import { PERMISSIONS, useDemo } from "@/state/DemoProvider";
import { Card, Segmented, cx } from "@/components/ui/primitives";
import { Donut, SERIES, StackedColumns } from "@/components/charts/Charts";
import { DayPicker, PeriodPicker } from "@/components/filters/PeriodPicker";
import { ActiveBadge, Avatars, TeamFormDrawer, isActive, useTeamStats, type TeamStats } from "./shared";

type SortKey = "name" | "penguins" | "status";
type StatusFilter = "all" | "active" | "inactive";

export function TeamsView() {
  const router = useRouter();
  const { dataset, snapshots, teamOf, range } = useDemo();
  const stats = useTeamStats();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("penguins");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);

  const total = dataset.penguins.length;
  const assignedIds = useMemo(() => dataset.penguins.filter((p) => dataset.teams.some((t) => t.id === teamOf(p.id))).map((p) => p.id), [dataset, teamOf]);
  const inWater = assignedIds.filter((id) => snapshots.get(id)!.status === "water").length;
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
      status: (a, b) => Number(!isActive(a.team)) - Number(!isActive(b.team)),
    };
    return [...list].sort((a, b) => by[sort](a, b) || a.team.name.localeCompare(b.team.name));
  }, [stats, q, sort, statusFilter]);

  // Distribution by zone: last recorded location of every penguin.
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

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-6 lg:px-8">
        <div className="min-w-0">
          <p className="eyebrow mb-1">Care Teams · SeaWorld Penguin Tracking & Care</p>
          <h1 className="text-[28px] font-semibold tracking-tight">Care teams</h1>
          <p className="mt-1 text-sm text-muted">Manage teams, assigned penguins and recorded activity.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker />
          <DayPicker />
          {PERMISSIONS.manageTeams && (
            <button onClick={() => setCreating(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white hover:bg-[#0b8178]">
              <Plus size={16} /> New team
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5 px-6 lg:px-8">
        {/* Indicators */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi icon={Users} color="#a78bfa" value={String(dataset.teams.length)} label="Care teams" sub={`${activeCount} active · ${dataset.teams.length - activeCount} inactive`} />
          <Kpi icon={Users} color="#5cb8ff" value={String(assignedIds.length)} label="Assigned penguins" sub={`${Math.round((assignedIds.length / Math.max(1, total)) * 100)}% of total · one team per penguin`} />
          <Kpi icon={Waves} color="#2fd8c8" value={`${Math.round((inWater / Math.max(1, assignedIds.length)) * 100)}%`} label="In water now" sub={`${inWater} of ${assignedIds.length} · current assignment`} />
        </div>

        {/* Teams */}
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight">Care teams</h2>
              <p className="text-xs text-muted">Select a team to see its details. Names are configurable and do not reflect the real structure.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 w-[220px] items-center gap-2 rounded-xl border border-line bg-ink/[0.05] px-3">
                <Search size={14} className="text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search team or lead…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
              </div>
              <Segmented<StatusFilter>
                size="sm"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
              <label className="flex h-9 items-center gap-2 rounded-xl border border-line bg-ink/[0.05] px-3 text-xs text-muted">
                Sort by
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="bg-transparent text-xs text-ink outline-none">
                  <option value="penguins">Assigned penguins</option>
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                </select>
              </label>
            </div>
          </div>
          {cards.length === 0 ? (
            <p className="panel px-4 py-8 text-center text-sm text-muted">No teams match the search.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {cards.map((x) => (
                <TeamCard key={x.team.id} x={x} total={total} onOpen={() => router.push(`/teams/${x.team.id}`)} />
              ))}
            </div>
          )}
        </section>

        {/* Analytics */}
        <div className="grid gap-5 xl:grid-cols-3">
          <Card title="Penguins by team" subtitle="Current assignment · click to open the team">
            <div className="flex flex-wrap items-center gap-5">
              <Donut
                size={136}
                thickness={16}
                parts={stats.map((x) => ({ value: x.penguinIds.length, color: x.team.color, label: x.team.name }))}
                center={
                  <div>
                    <p className="num text-2xl font-semibold leading-none">{assignedIds.length}</p>
                    <p className="text-[10px] text-faint">assigned</p>
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

          <Card title="Distribution by zone" subtitle="Last recorded location · all teams · click to open the map">
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
            {zoneRows.length > 7 && <p className="mt-1 px-1.5 text-[11px] text-faint">+{zoneRows.length - 7} more {zoneRows.length - 7 === 1 ? "zone" : "zones"} in Habitat Map</p>}
          </Card>

          <Card title="Overall team activity" subtitle={`${range.label} · recorded hours, summed across assigned penguins`}>
            <StackedColumns
              height={142}
              labelEvery={byHour ? 6 : agg.daily.length > 8 ? 2 : 1}
              format={fmtHours}
              series={[
                { key: "water", color: SERIES.water, label: "Water" },
                { key: "land", color: SERIES.land, label: "Land" },
              ]}
              data={
                byHour
                  ? agg.hourly.map((h, i) => ({ label: `${i}h`, tooltip: `${String(i).padStart(2, "0")}:00`, values: { water: h.water, land: h.land } }))
                  : agg.daily.map((d) => ({ label: String(new Date(d.day).getDate()), tooltip: fmtWeekday(d.day), values: { water: d.water, land: d.land } }))
              }
            />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
              <Dot color={SERIES.water}>Water</Dot>
              <Dot color={SERIES.land}>Land</Dot>
            </div>
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
          <p className="text-[11px] text-faint">Team lead · {team.members.length} {team.members.length === 1 ? "member" : "members"}</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted">Assigned penguins</span>
          <span>
            <b className="num text-sm">{x.penguinIds.length}</b> <span className="text-faint">· {pct}% of total</span>
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: team.color }} />
        </div>
      </div>
      <p className="mt-3 truncate text-[11px] text-muted" title={team.zoneIds.map((z) => ZONE_BY_ID[z]?.name).join(", ")}>
        <span className="text-faint">Zones: </span>
        {team.zoneIds.length ? team.zoneIds.slice(0, 3).map((z) => ZONE_BY_ID[z]?.name).join(", ") : "No zones assigned"}
        {team.zoneIds.length > 3 && ` +${team.zoneIds.length - 3}`}
      </p>
      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-xs">
        <span className="inline-flex items-center gap-1 text-muted">
          <Waves size={13} className="text-faint" /> {x.inWater} in water now
        </span>
        <Link
          href={`/map?team=${team.id}`}
          onClick={(e) => e.stopPropagation()}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-line-strong px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-ink"
        >
          <MapPinned size={12} /> View on map
        </Link>
      </div>
    </article>
  );
}

function Kpi({ icon: Icon, color, value, label, sub }: { icon: typeof Users; color: string; value: string; label: string; sub?: string }) {
  return (
    <div className="panel flex items-center gap-3 px-4 py-3.5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${color}1f`, color }}>
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="num text-xl font-semibold leading-tight">{value}</p>
        <p className="truncate text-xs text-muted">{label}</p>
        {sub && <p className="truncate text-[10px] text-faint" title={sub}>{sub}</p>}
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
