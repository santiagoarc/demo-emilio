"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPinned, Radio, Search, SearchX, Users, WifiOff, X } from "lucide-react";
import { FIX_STATUS, MONITOR_ZONES, MONITOR_ZONE_BY_ID, type FixStatus, type MonitorBird, type Stay } from "@/domain/aviaryTracking";
import type { CareTeam } from "@/domain/types";
import { MONITOR_SPECIES, MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { MONITOR_TEAMS, MONITOR_TEAM_BY_ID, type MonitorTeam, type TeamId } from "@/data/aviaryTeams";
import { activityBreakdown, flightStats, type FlightStats } from "@/logic/aviaryActivity";
import type { Fix } from "@/logic/aviaryTracking";
import { DAY, HOUR, MIN, fmtAgo, fmtDateTime, fmtHours, fmtWeekday, startOfDay } from "@/logic/time";
import { useTeamAssignments } from "@/state/useTeams";
import { Badge, Card, EmptyState, Segmented, Select, cx } from "@/components/ui/primitives";
import { BarList, Donut, StackedColumns } from "@/components/charts/Charts";
import { FilterMenu } from "@/components/filters/FilterMenu";
import { ActiveBadge, Avatars, initials } from "@/features/teams/shared";
import { Dot, Kpi, TeamCard } from "@/features/teams/TeamsView";
import { HBar, Kpi as DetailKpi, PageBtn } from "@/features/teams/TeamDetailView";
import { BirdInsightBlock } from "./monitor/BirdActivity";
import { SpeciesAvatar } from "./SpeciesAvatar";
import { lastPlace } from "./AviaryPanels";
import { useAviarySnapshot } from "./common";

/**
 * Aviary monitoring teams: the penguin care-teams screens (same cards, indicators,
 * charts, table and tabs) over the ten aviary teams and their 500 birds.
 */

const C = { flying: "#2563eb", walking: "#c7850c", perched: "#16a34a" };
type PeriodId = "24h" | "7d";
const PERIOD: Record<PeriodId, { ms: number; label: string }> = { "24h": { ms: DAY, label: "Last 24 h" }, "7d": { ms: 7 * DAY, label: "Last 7 days" } };
const fmtMin = (ms: number) => (ms >= HOUR ? fmtHours(ms) : `${Math.round(ms / MIN)} min`);
const isOk = (s: FixStatus) => s === "detected" || s === "moving";

/** The aviary team in the shape the shared team components use. */
function asCareTeam(t: MonitorTeam, zoneIds: string[]): CareTeam {
  return { id: t.id, name: t.name, lead: t.lead, members: t.members, color: t.color, zoneIds, focus: "Aviary monitoring", active: true };
}

/** Birds, current state and usual zones of every team, from the current assignment. */
function useBirdTeams() {
  const snap = useAviarySnapshot();
  const { registry, fixes } = snap;
  const { teamOf, assign } = useTeamAssignments(registry);
  const stats = useMemo(
    () =>
      MONITOR_TEAMS.map((t) => {
        const birds = registry.birds.filter((b) => teamOf(b) === t.id);
        const zones = new Map<string, number>();
        for (const b of birds) {
          const z = fixes.get(b.id)?.det?.zoneId;
          if (z) zones.set(z, (zones.get(z) ?? 0) + 1);
        }
        const zoneList = [...zones.entries()].sort((a, b) => b[1] - a[1]);
        return {
          t,
          team: asCareTeam(t, zoneList.map(([z]) => z)),
          birds,
          detected: birds.filter((b) => isOk(fixes.get(b.id)!.status)).length,
          noSignal: birds.filter((b) => fixes.get(b.id)!.status === "no-signal").length,
          species: new Set(birds.map((b) => b.speciesId)).size,
          zones: zoneList,
        };
      }),
    [registry, fixes, teamOf],
  );
  return { ...snap, teamOf, assign, stats };
}

/** Flying, walking and perched time of a group of birds, by hour of day or by day. */
function groupActivity(birds: MonitorBird[], stays: Map<string, Stay[]>, from: number, to: number, byHour: boolean) {
  if (byHour) {
    const h = Array.from({ length: 24 }, () => ({ flying: 0, walking: 0, perched: 0 }));
    for (const b of birds) {
      const br = activityBreakdown(b, stays.get(b.id) ?? [], from, to);
      br.hourly.forEach((x, i) => {
        h[i].flying += x.flying;
        h[i].walking += x.walking;
        h[i].perched += x.perched;
      });
    }
    return h.map((x, i) => ({ label: `${i}h`, tooltip: `${String(i).padStart(2, "0")}:00`, values: x }));
  }
  const out = [];
  for (let d = startOfDay(from); d < to; d += DAY) {
    const v = { flying: 0, walking: 0, perched: 0 };
    for (const b of birds) {
      const s = flightStats(b, stays.get(b.id) ?? [], Math.max(d, from), Math.min(d + DAY, to));
      v.flying += s.flyingMs;
      v.walking += s.walkingMs;
      v.perched += s.perchedMs;
    }
    out.push({ label: String(new Date(d).getDate()), tooltip: fmtWeekday(d), values: v });
  }
  return out;
}

/* ───────────── Teams list ───────────── */

type SortKey = "name" | "birds" | "attention";

export function AviaryTeamsView() {
  const router = useRouter();
  const { registry, ds, asOf, fixes, stats } = useBirdTeams();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("birds");
  const [period, setPeriod] = useState<PeriodId>("24h");
  const total = registry.birds.length;
  const detected = [...fixes.values()].filter((f) => isOk(f.status)).length;

  const cards = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = stats.filter((x) => !s || [x.t.name, x.t.lead, ...x.t.members].some((v) => v.toLowerCase().includes(s)));
    const by: Record<SortKey, (a: (typeof stats)[number], b: (typeof stats)[number]) => number> = {
      name: (a, b) => a.t.name.localeCompare(b.t.name),
      birds: (a, b) => b.birds.length - a.birds.length,
      attention: (a, b) => b.noSignal - a.noSignal,
    };
    return [...list].sort((a, b) => by[sort](a, b) || a.t.name.localeCompare(b.t.name));
  }, [stats, q, sort]);

  const zoneRows = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of fixes.values()) if (f.det?.zoneId) m.set(f.det.zoneId, (m.get(f.det.zoneId) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [fixes]);

  const from = Math.max(ds.windowStart, asOf - PERIOD[period].ms);
  const activity = useMemo(() => groupActivity(registry.birds, ds.stays, from, asOf, period === "24h"), [registry, ds, from, asOf, period]);

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-6 lg:px-8">
        <div className="min-w-0">
          <p className="eyebrow mb-1">Monitoring Teams · Aviary</p>
          <h1 className="text-[28px] font-semibold tracking-tight">Monitoring teams</h1>
          <p className="mt-1 text-sm text-muted">Teams, assigned birds and recorded activity.</p>
        </div>
        <Segmented size="sm" value={period} onChange={setPeriod} options={[{ value: "24h", label: "24 h" }, { value: "7d", label: "7 days" }]} />
      </div>

      <div className="space-y-5 px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi icon={Users} color="#a78bfa" value={String(MONITOR_TEAMS.length)} label="Monitoring teams" sub={`${MONITOR_TEAMS.length} active · 0 inactive`} />
          <Kpi icon={Users} color="#5cb8ff" value={String(stats.reduce((a, x) => a + x.birds.length, 0))} label="Assigned birds" sub={`${Math.round((stats.reduce((a, x) => a + x.birds.length, 0) / Math.max(1, total)) * 100)}% of total · one team per bird`} />
          <Kpi icon={Radio} color="#2fd8c8" value={`${Math.round((detected / Math.max(1, total)) * 100)}%`} label="Detected now" sub={`${detected} of ${total} · current assignment`} />
        </div>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight">Monitoring teams</h2>
              <p className="text-xs text-muted">Select a team to see its details. Names are configurable and do not reflect the real structure.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 w-[220px] items-center gap-2 rounded-xl border border-line bg-ink/[0.05] px-3">
                <Search size={14} className="text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search team or member…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
              </div>
              <label className="flex h-9 items-center gap-2 rounded-xl border border-line bg-ink/[0.05] px-3 text-xs text-muted">
                Sort by
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="bg-transparent text-xs text-ink outline-none">
                  <option value="birds">Assigned birds</option>
                  <option value="name">Name</option>
                  <option value="attention">Without signal</option>
                </select>
              </label>
            </div>
          </div>
          {cards.length === 0 ? (
            <p className="panel px-4 py-8 text-center text-sm text-muted">No teams match the search.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {cards.map((x) => (
                <TeamCard
                  key={x.t.id}
                  team={x.team}
                  count={x.birds.length}
                  total={total}
                  assignedLabel="Assigned birds"
                  zoneNames={x.zones.map(([z]) => MONITOR_ZONE_BY_ID[z].name)}
                  now={{ icon: Radio, text: `${x.detected} detected now` }}
                  mapHref={`/aviary/map?team=${x.t.id}`}
                  onOpen={() => router.push(`/aviary/teams/${x.t.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-3">
          <Card title="Birds by team" subtitle="Current assignment · click to open the team">
            <div className="flex flex-wrap items-center gap-5">
              <Donut
                size={136}
                thickness={16}
                parts={stats.map((x) => ({ value: x.birds.length, color: x.t.color, label: x.t.name }))}
                center={
                  <div>
                    <p className="num text-2xl font-semibold leading-none">{total}</p>
                    <p className="text-[10px] text-faint">assigned</p>
                  </div>
                }
              />
              <ul className="min-w-[180px] flex-1 space-y-0.5">
                {[...stats].sort((a, b) => b.birds.length - a.birds.length).map((x) => (
                  <li key={x.t.id}>
                    <Link href={`/aviary/teams/${x.t.id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-0.5 text-sm hover:bg-ink/[0.04]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.t.color }} />
                      <span className="flex-1 truncate">{x.t.name}</span>
                      <span className="num font-semibold">{x.birds.length}</span>
                      <span className="num w-10 text-right text-xs text-faint">{Math.round((x.birds.length / Math.max(1, total)) * 100)}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card title="Distribution by zone" subtitle="Last detected location · all teams · click to open the map">
            <ul className="space-y-0.5">
              {zoneRows.map(([z, n]) => (
                <li key={z}>
                  <Link href="/aviary/map" className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-ink/[0.04]">
                    <span className="w-[112px] shrink-0 truncate text-[13px]">{MONITOR_ZONE_BY_ID[z].name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.05]">
                      <span className="block h-full rounded-full bg-accent-2" style={{ width: `${(n / zoneRows[0][1]) * 100}%` }} />
                    </span>
                    <span className="num w-7 text-right text-[13px] font-semibold">{n}</span>
                    <span className="num w-9 text-right text-[11px] text-faint">{Math.round((n / Math.max(1, total)) * 100)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <ActivityCard data={activity} label={`${PERIOD[period].label} · summed across assigned birds`} byHour={period === "24h"} title="Overall team activity" />
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ data, label, byHour, title }: { data: ReturnType<typeof groupActivity>; label: string; byHour: boolean; title: string }) {
  return (
    <Card title={title} subtitle={label}>
      <StackedColumns
        height={142}
        labelEvery={byHour ? 6 : 1}
        format={fmtMin}
        series={[
          { key: "flying", color: C.flying, label: "Flying" },
          { key: "walking", color: C.walking, label: "Walking" },
        ]}
        data={data}
      />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <Dot color={C.flying}>Flying</Dot>
        <Dot color={C.walking}>Walking</Dot>
      </div>
    </Card>
  );
}

/* ───────────── Team detail ───────────── */

type Tab = "overview" | "birds" | "staff";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "birds", label: "Birds" },
  { id: "staff", label: "Staff" },
];

export function AviaryTeamDetailView() {
  const { id } = useParams<{ id: string }>();
  const teamId = decodeURIComponent(id ?? "");
  if (!(teamId in MONITOR_TEAM_BY_ID)) {
    return (
      <div className="p-8">
        <Card>
          <EmptyState icon={SearchX} title={`Team ${teamId} not found`} action={<Link href="/aviary/teams" className="text-sm text-accent hover:underline">All teams</Link>} />
        </Card>
      </div>
    );
  }
  return <TeamDetail key={teamId} teamId={teamId as TeamId} />;
}

function TeamDetail({ teamId }: { teamId: TeamId }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { registry, ds, asOf, fixes, stats, assign, teamOf } = useBirdTeams();
  const [period, setPeriod] = useState<PeriodId>("24h");
  const x = stats.find((s) => s.t.id === teamId)!;
  const team = x.team;
  const tab = (TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "overview") as Tab;
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
  const total = registry.birds.length;
  const from = Math.max(ds.windowStart, asOf - PERIOD[period].ms);
  const perBird = useMemo(() => new Map(x.birds.map((b) => [b.id, flightStats(b, ds.stays.get(b.id) ?? [], from, asOf)])), [x.birds, ds, from, asOf]);
  const activity = useMemo(() => groupActivity(x.birds, ds.stays, from, asOf, period === "24h"), [x.birds, ds, from, asOf, period]);
  const share = (n: number) => (x.birds.length ? `${Math.round((n / x.birds.length) * 100)}% of the team` : "No data");
  const speciesRows = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of x.birds) m.set(b.speciesId, (m.get(b.speciesId) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [x.birds]);

  return (
    <div className="pb-10">
      <div className="px-6 pt-5 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/aviary/teams" className="inline-flex h-10 items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 pl-2.5 pr-4 text-sm font-medium text-ink transition hover:border-accent hover:bg-accent/20">
            <ChevronLeft size={18} className="text-accent" /> All teams
          </Link>
          <nav className="flex items-center gap-1 text-xs text-muted">
            <Link href="/aviary/teams" className="hover:text-ink">Monitoring Teams</Link>
            <ChevronRight size={12} className="text-faint" />
            <span className="text-ink">{team.name}</span>
          </nav>
          <div className="ml-auto">
            <Segmented size="sm" value={period} onChange={setPeriod} options={[{ value: "24h", label: "24 h" }, { value: "7d", label: "7 days" }]} />
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
            </div>
            <p className="text-sm text-muted">
              {team.focus} · {x.birds.length} assigned birds ({Math.round((x.birds.length / Math.max(1, total)) * 100)}% of total) · {x.species} species
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Avatars team={team} max={4} size={34} />
            <div className="leading-tight">
              <p className="text-sm font-medium">{team.lead}</p>
              <p className="text-[11px] text-faint">Team lead · {team.members.length} members</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 items-center gap-2 rounded-xl border border-line bg-ink/[0.05] px-3 text-xs text-muted">
              Team
              <select value={teamId} onChange={(e) => router.push(`/aviary/teams/${e.target.value}${tab !== "overview" ? `?tab=${tab}` : ""}`)} className="bg-transparent text-xs text-ink outline-none">
                {MONITOR_TEAMS.map((t) => (
                  <option key={t.id} value={t.id} className="bg-panel-solid">
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <Link href={`/aviary/map?team=${teamId}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white hover:bg-[#0b8178]">
              <MapPinned size={15} /> View on map
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4 px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <DetailKpi icon={Users} color={team.color} value={String(x.birds.length)} label="Assigned birds" sub={`${Math.round((x.birds.length / Math.max(1, total)) * 100)}% of total`} />
          <DetailKpi icon={Radio} color="#2fd8c8" value={String(x.detected)} label="Detected now" sub={share(x.detected)} />
          <DetailKpi icon={WifiOff} color="#dc2626" value={String(x.noSignal)} label="No recent signal" sub={share(x.noSignal)} />
        </div>

        <div className="panel flex gap-1 overflow-x-auto p-1">
          {TABS.map((t) => {
            const count = t.id === "birds" ? x.birds.length : t.id === "staff" ? team.members.length : null;
            return (
              <button
                key={t.id}
                onClick={() => setParams({ tab: t.id === "overview" ? null : t.id, sel: null })}
                className={cx("flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-sm font-medium transition", tab === t.id ? "bg-accent/15 text-ink shadow-[inset_0_-2px_0_var(--accent)]" : "text-muted hover:bg-ink/[0.04] hover:text-ink")}
              >
                {t.label}
                {count !== null && <span className="num rounded-md bg-ink/[0.06] px-1.5 text-[11px] text-muted">{count}</span>}
              </button>
            );
          })}
        </div>

        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <Card title="Distribution by zone" subtitle="Last detected location · click to open on the map">
                <ul className="space-y-0.5">
                  {x.zones.map(([z, n]) => (
                    <li key={z}>
                      <Link href={`/aviary/map?team=${teamId}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-ink/[0.04]">
                        <span className="w-[118px] shrink-0 truncate text-[13px]">{MONITOR_ZONE_BY_ID[z].name}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.05]">
                          <span className="block h-full rounded-full bg-accent-2" style={{ width: `${(n / Math.max(1, x.zones[0]?.[1] ?? 1)) * 100}%` }} />
                        </span>
                        <span className="num w-6 text-right text-[13px] font-semibold">{n}</span>
                        <span className="num w-9 text-right text-[11px] text-faint">{Math.round((n / Math.max(1, x.birds.length)) * 100)}%</span>
                        <MapPinned size={12} className="text-faint" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
              <ActivityCard data={activity} label={`${PERIOD[period].label} · recorded time of its birds`} byHour={period === "24h"} title="Team activity" />
              <Card title="Species supervised" subtitle={`${x.species} species · birds of each`} className="lg:col-span-2 xl:col-span-1">
                <BarList
                  items={speciesRows.map(([sid, n]) => ({ key: sid, label: MONITOR_SPECIES_BY_ID[sid].common, value: n, color: MONITOR_SPECIES_BY_ID[sid].color }))}
                  format={(v) => String(v)}
                />
              </Card>
            </div>
            <BirdTable birds={x.birds} fixes={fixes} perBird={perBird} periodLabel={PERIOD[period].label} asOf={asOf} selected={null} onSelect={(bid) => setParams({ tab: "birds", sel: bid })} compact />
          </div>
        )}

        {tab === "birds" && (
          <div className={cx("grid items-start gap-4", sel && x.birds.some((b) => b.id === sel) && "xl:grid-cols-[minmax(0,1fr)_350px]")}>
            <BirdTable birds={x.birds} fixes={fixes} perBird={perBird} periodLabel={PERIOD[period].label} asOf={asOf} selected={sel} onSelect={(bid) => setParams({ sel: sel === bid ? null : bid })} />
            {sel && x.birds.some((b) => b.id === sel) && (
              <BirdSide key={sel} fix={fixes.get(sel)!} asOf={asOf} teamId={teamOf(fixes.get(sel)!.bird)} onAssign={(t) => (assign(fixes.get(sel)!.bird, t), setParams({ sel: null }))} onClose={() => setParams({ sel: null })} />
            )}
          </div>
        )}

        {tab === "staff" && (
          <section className="panel overflow-hidden">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] text-muted">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-2 py-2.5 font-medium">Role</th>
                    <th className="px-2 py-2.5 font-medium">Assignment</th>
                    <th className="px-2 py-2.5 font-medium">Scheduled shift</th>
                  </tr>
                </thead>
                <tbody>
                  {team.members.map((m) => (
                    <tr key={m} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold text-[#03101c]" style={{ background: team.color }}>{initials(m)}</span>
                          {m}
                        </span>
                      </td>
                      <td className="px-2 py-2">{m === team.lead ? <Badge tone="accent">Team lead</Badge> : <span className="text-xs text-muted">Keeper</span>}</td>
                      <td className="px-2 py-2"><Badge tone="ok">Active on team</Badge></td>
                      <td className="px-2 py-2 text-xs text-faint">No shift set up</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ───────────── Bird table ───────────── */

type BirdSort = "id" | "flying" | "perched" | "last";
const PER = 10;

function BirdTable({ birds, fixes, perBird, periodLabel, asOf, selected, onSelect, compact }: {
  birds: MonitorBird[];
  fixes: Map<string, Fix>;
  perBird: Map<string, FlightStats>;
  periodLabel: string;
  asOf: number;
  selected: string | null;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [species, setSpecies] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [status, setStatus] = useState<FixStatus[]>([]);
  const [sort, setSort] = useState<{ k: BirdSort; dir: 1 | -1 }>({ k: "id", dir: 1 });
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = birds.filter((b) => {
      const f = fixes.get(b.id)!;
      if (s && ![b.id, b.name ?? "", b.device.id].some((v) => v.toLowerCase().includes(s))) return false;
      if (species.length && !species.includes(b.speciesId)) return false;
      if (zones.length && !zones.includes(f.det?.zoneId ?? "")) return false;
      if (status.length && !status.includes(f.status)) return false;
      return true;
    });
    const val = (b: MonitorBird) =>
      sort.k === "flying" ? (perBird.get(b.id)?.flyingMs ?? -1) : sort.k === "perched" ? (perBird.get(b.id)?.perchedMs ?? -1) : sort.k === "last" ? (fixes.get(b.id)!.det?.at ?? 0) : 0;
    out.sort((a, b) => (sort.k === "id" ? a.id.localeCompare(b.id) : val(a) - val(b)) * sort.dir || a.id.localeCompare(b.id));
    return out;
  }, [birds, fixes, perBird, q, species, zones, status, sort]);

  const per = compact ? 8 : PER;
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const pg = Math.min(page, pages);
  const pageRows = rows.slice((pg - 1) * per, pg * per);
  const maxF = Math.max(1, ...rows.map((b) => perBird.get(b.id)?.flyingMs ?? 0));
  const maxP = Math.max(1, ...rows.map((b) => perBird.get(b.id)?.perchedMs ?? 0));
  const hasFilters = !!(q || species.length || zones.length || status.length);
  const sortBy = (k: BirdSort) => (setSort((cur) => ({ k, dir: cur.k === k ? (-cur.dir as 1 | -1) : k === "id" ? 1 : -1 })), setPage(1));
  const th = (k: BirdSort, label: string, sub?: string) => (
    <th className="px-2 py-2.5 font-medium">
      <button onClick={() => sortBy(k)} className={cx("text-left hover:text-ink", sort.k === k && "text-ink")}>
        {label} {sort.k === k ? (sort.dir === 1 ? "↑" : "↓") : ""}
        {sub && <span className="block text-[10px] font-normal text-faint">{sub}</span>}
      </button>
    </th>
  );

  return (
    <section className="panel min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        {compact && <h3 className="mr-2 text-[15px] font-semibold">Team birds <span className="num text-muted">({rows.length})</span></h3>}
        <div className="flex h-10 min-w-[200px] flex-[2] items-center gap-2 rounded-xl border border-line bg-ink/[0.05] px-3">
          <Search size={14} className="text-muted" />
          <input value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder="Search by ID, name or device…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
        </div>
        <FilterMenu className="flex-1" label="Species" value={species} onChange={(v) => (setSpecies(v), setPage(1))} options={MONITOR_SPECIES.filter((s) => birds.some((b) => b.speciesId === s.id)).map((s) => ({ value: s.id, label: s.common, color: s.color }))} />
        <FilterMenu className="flex-1" label="Zone" value={zones} onChange={(v) => (setZones(v), setPage(1))} options={MONITOR_ZONES.map((z) => ({ value: z.id, label: z.name }))} />
        <FilterMenu<FixStatus> className="flex-1" label="Status" value={status} onChange={(v) => (setStatus(v), setPage(1))} options={(Object.keys(FIX_STATUS) as FixStatus[]).map((s) => ({ value: s, label: FIX_STATUS[s].label, color: FIX_STATUS[s].color }))} />
        {hasFilters && (
          <button onClick={() => (setQ(""), setSpecies([]), setZones([]), setStatus([]))} className="inline-flex h-10 items-center gap-1 px-2 text-xs text-muted hover:text-ink">
            <X size={13} /> Clear
          </button>
        )}
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-muted">
              <th className="px-3 py-2.5 font-medium">Photo</th>
              {th("id", "ID")}
              <th className="px-2 py-2.5 font-medium">Species</th>
              <th className="px-2 py-2.5 font-medium">Last location</th>
              <th className="px-2 py-2.5 font-medium">Status</th>
              {th("flying", "Flying", periodLabel)}
              {th("perched", "Perched in trees", periodLabel)}
              {th("last", "Last detection")}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((b) => {
              const f = fixes.get(b.id)!;
              const sp = MONITOR_SPECIES_BY_ID[b.speciesId];
              const st = perBird.get(b.id);
              const na = !st?.measurable;
              return (
                <tr key={b.id} onClick={() => onSelect(b.id)} className={cx("cursor-pointer border-b border-line/70 transition last:border-0", selected === b.id ? "bg-accent/[0.08]" : "hover:bg-ink/[0.025]")}>
                  <td className="px-3 py-1.5"><SpeciesAvatar code={sp.code} size={32} ring={sp.color} /></td>
                  <td className="px-2 py-2 font-mono text-[13px]">{b.id}</td>
                  <td className="px-2 py-2 text-xs text-muted">{sp.common}</td>
                  <td className="px-2 py-2">
                    <span className="inline-flex rounded-md border border-line-strong px-1.5 py-0.5 text-xs">{lastPlace(f)}</span>
                  </td>
                  <td className="px-2 py-2 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: FIX_STATUS[f.status].color }} />
                      {FIX_STATUS[f.status].label}
                    </span>
                  </td>
                  <td className="px-2 py-2">{na ? <span className="text-xs text-faint">Not available</span> : <HBar value={st!.flyingMs} max={maxF} color={C.flying} format={fmtMin} />}</td>
                  <td className="px-2 py-2">{na ? <span className="text-xs text-faint">Not available</span> : <HBar value={st!.perchedMs} max={maxP} color={C.perched} />}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-muted">
                    {f.det ? (
                      <>
                        {fmtDateTime(f.det.at, asOf)}
                        <span className="block text-[10px] text-faint">{fmtAgo(f.det.at, asOf)} · {Math.round(f.det.confidence * 100)}% confidence</span>
                      </>
                    ) : (
                      "No data"
                    )}
                  </td>
                  <td className="pr-3">
                    <Link href={`/aviary/birds/${b.id}`} onClick={(e) => e.stopPropagation()} title="Open profile" className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-ink/5 hover:text-ink">
                      <ChevronRight size={15} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState icon={SearchX} title={birds.length ? "No birds match" : "This team has no assigned birds"} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-muted">
        <span>
          Showing {rows.length ? (pg - 1) * per + 1 : 0}–{Math.min(pg * per, rows.length)} of {rows.length}
          {compact ? " · click a row to see its summary" : ""}
        </span>
        <div className="flex items-center gap-1">
          <PageBtn disabled={pg <= 1} onClick={() => setPage(pg - 1)}><ChevronLeft size={14} /></PageBtn>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <PageBtn key={n} active={n === pg} onClick={() => setPage(n)}>{n}</PageBtn>
          ))}
          <PageBtn disabled={pg >= pages} onClick={() => setPage(pg + 1)}><ChevronRight size={14} /></PageBtn>
        </div>
      </div>
    </section>
  );
}

/** Summary of the selected bird beside the table, with reassignment (as the penguin side panel). */
function BirdSide({ fix, asOf, teamId, onAssign, onClose }: { fix: Fix; asOf: number; teamId: TeamId; onAssign: (t: TeamId) => void; onClose: () => void }) {
  const b = fix.bird;
  const sp = MONITOR_SPECIES_BY_ID[b.speciesId];
  const [to, setTo] = useState<TeamId>(teamId);
  return (
    <div className="space-y-3 xl:sticky xl:top-4">
      <section className="panel space-y-4 p-4">
        <div className="flex items-start gap-3">
          <SpeciesAvatar code={sp.code} size={52} ring={sp.color} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-base font-semibold">{b.id}</p>
            <p className="text-xs text-muted">{sp.common}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: FIX_STATUS[fix.status].color }} /> {FIX_STATUS[fix.status].label} · {lastPlace(fix)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <BirdInsightBlock bird={b} asOf={asOf} />
        <Link href={`/aviary/birds/${b.id}`} className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-semibold text-white hover:bg-[#0b8178]">
          Open individual profile <ChevronRight size={14} />
        </Link>
      </section>
      <section className="panel p-4">
        <p className="text-sm font-semibold">Reassign team</p>
        <p className="mt-0.5 text-[11px] text-muted">Moves {b.id} to another team across the aviary screens.</p>
        <div className="mt-2 flex gap-2">
          <Select value={to} onChange={(e) => setTo(e.target.value as TeamId)} className="h-9 flex-1">
            {MONITOR_TEAMS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.id === teamId ? " (current)" : ""}
              </option>
            ))}
          </Select>
          <button disabled={to === teamId} onClick={() => onAssign(to)} className="h-9 rounded-xl bg-accent px-3 text-sm font-semibold text-white disabled:opacity-40">
            Reassign
          </button>
        </div>
      </section>
    </div>
  );
}
