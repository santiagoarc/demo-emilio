"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowRightLeft,
  ArrowUp,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  History,
  MapPinned,
  Mountain,
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
import { ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES, SPECIES_BY_ID } from "@/domain/species";
import type { Shift, SpeciesId } from "@/domain/types";
import { QUALITY_LABEL, SOURCE_SHORT } from "@/logic/labels";
import { computeActivity, type Breakdown } from "@/logic/metrics";
import { STATUS_LABEL, type LiveStatus, type Snapshot } from "@/logic/status";
import { HOUR, fmtDateTime, fmtHours, fmtWeekday } from "@/logic/time";
import { PERMISSIONS, useDemo } from "@/state/DemoProvider";
import { Badge, Button, Card, EmptyState, Select, cx } from "@/components/ui/primitives";
import { SERIES, StackedColumns } from "@/components/charts/Charts";
import { FilterMenu } from "@/components/filters/FilterMenu";
import { DayPicker, PeriodPicker } from "@/components/filters/PeriodPicker";
import { PenguinIllustration } from "@/components/penguin/PenguinIllustration";
import { StatusPill, STATUS_COLOR } from "@/components/penguin/StatusPill";
import { SpeciesPenguinPanel } from "@/features/species/SpeciesPenguinPanel";
import { ActiveBadge, Avatars, TeamFormDrawer, initials, isActive } from "./shared";

type Tab = "overview" | "penguins" | "schedule" | "staff";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "penguins", label: "Penguins" },
  { id: "schedule", label: "Schedule" },
  { id: "staff", label: "Staff" },
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const AVAIL_LABEL: Record<Shift["availability"], string> = { available: "Available", partial: "Partial", unavailable: "Unavailable" };

type SortKey = "id" | "name" | "last" | "water" | "land";
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
          <EmptyState icon={SearchX} title={`Team "${id}" not found`} action={<Link href="/teams" className="text-sm text-accent hover:underline">Back to Care Teams</Link>} />
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
  const { dataset, teamOf, snapshots, range } = useDemo();
  const team = dataset.teams.find((t) => t.id === teamId)!;
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
  const [table, setTable] = useState<TableState>(EMPTY_TABLE);
  const [editing, setEditing] = useState(false);

  const penguins = useMemo(() => dataset.penguins.filter((p) => teamOf(p.id) === teamId), [dataset, teamOf, teamId]);
  const ids = useMemo(() => penguins.map((p) => p.id), [penguins]);
  const agg = useMemo(() => computeActivity(dataset, ids, range.from, range.to), [dataset, ids, range]);

  const inWater = ids.filter((id) => snapshots.get(id)!.status === "water").length;
  const onLand = ids.filter((id) => {
    const st = snapshots.get(id)!.status;
    return st === "land" || st === "resting";
  }).length;
  const share = (n: number) => (penguins.length ? `${Math.round((n / penguins.length) * 100)}% of the team` : "No data");
  const total = dataset.penguins.length;

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="px-6 pt-5 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/teams"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 pl-2.5 pr-4 text-sm font-medium text-ink transition hover:border-accent hover:bg-accent/20"
          >
            <ChevronLeft size={18} className="text-accent" /> All teams
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
            </div>
            <p className="text-sm text-muted">
              {team.focus || "No description"} · {penguins.length} assigned {penguins.length === 1 ? "penguin" : "penguins"} ({Math.round((penguins.length / Math.max(1, total)) * 100)}% of total)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Avatars team={team} max={4} size={34} />
            <div className="leading-tight">
              <p className="text-sm font-medium">{team.lead}</p>
              <p className="text-[11px] text-faint">Team lead · {team.members.length} {team.members.length === 1 ? "member" : "members"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 items-center gap-2 rounded-xl border border-line bg-ink/[0.05] px-3 text-xs text-muted">
              Team
              <select value={teamId} onChange={(e) => router.push(`/teams/${e.target.value}${tab !== "overview" ? `?tab=${tab}` : ""}`)} className="bg-transparent text-xs text-ink outline-none">
                {dataset.teams.map((t) => (
                  <option key={t.id} value={t.id} className="bg-panel-solid">
                    {t.name}
                    {isActive(t) ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </label>
            {PERMISSIONS.manageTeams && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Edit team
              </Button>
            )}
            <Link href={`/map?team=${teamId}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white hover:bg-[#0b8178]">
              <MapPinned size={15} /> View on map
            </Link>
          </div>
        </div>
        {!isActive(team) && (
          <p className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            Inactive team. Its records are kept and its penguins stay assigned until they are explicitly reassigned.
          </p>
        )}
      </div>

      <div className="mt-4 space-y-4 px-6 lg:px-8">
        {/* Indicators */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi icon={Users} color={team.color} value={String(penguins.length)} label="Assigned penguins" sub={`${Math.round((penguins.length / Math.max(1, total)) * 100)}% of total`} />
          <Kpi icon={Waves} color="#2fd8c8" value={String(inWater)} label="In water now" sub={share(inWater)} />
          <Kpi icon={Mountain} color="#9fb4c7" value={String(onLand)} label="On land now" sub={share(onLand)} />
        </div>

        {/* Tabs */}
        <div className="panel flex gap-1 overflow-x-auto p-1">
          {TABS.map((t) => {
            const count = t.id === "penguins" ? penguins.length : t.id === "staff" ? team.members.length : null;
            return (
              <button
                key={t.id}
                onClick={() => setParams({ tab: t.id === "overview" ? null : t.id })}
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
            {/* Three cards at the same height; with two columns the schedule spans the full row. */}
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <ZonePanel teamId={teamId} ids={ids} />
              <ActivityPanel agg={agg} label={range.label} span={range.to - range.from} />
              <ScheduleSide teamId={teamId} onAll={() => setParams({ tab: "schedule" })} className="lg:col-span-2 xl:col-span-1" />
            </div>
            <PenguinTable
              teamId={teamId}
              ids={ids}
              perPenguin={agg.perPenguin}
              state={table}
              setState={setTable}
              selected={null}
              onSelect={(id) => setParams({ tab: "penguins", sel: id })}
              compact
              rangeLabel={range.label}
            />
          </div>
        )}

        {tab === "penguins" && (
          <div className={cx("grid items-start gap-4", sel && ids.includes(sel) && "xl:grid-cols-[minmax(0,1fr)_350px]")}>
            <PenguinTable
              teamId={teamId}
              ids={ids}
              perPenguin={agg.perPenguin}
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

        {tab === "schedule" && <ScheduleTab teamId={teamId} />}
        {tab === "staff" && <StaffTab teamId={teamId} />}
      </div>

      <TeamFormDrawer open={editing} onClose={() => setEditing(false)} team={team} />
    </div>
  );
}

/* ───────────── Overview ───────────── */

function ZonePanel({ teamId, ids }: { teamId: string; ids: string[] }) {
  const { snapshots } = useDemo();
  const rows = useMemo(() => {
    const m = new Map<string, { n: number }>();
    let none = 0;
    for (const id of ids) {
      const s = snapshots.get(id)!;
      const z = s.reading?.zoneId;
      if (!z) {
        none++;
        continue;
      }
      const e = m.get(z) ?? { n: 0 };
      e.n++;
      m.set(z, e);
    }
    return { list: [...m.entries()].sort((a, b) => b[1].n - a[1].n), none };
  }, [ids, snapshots]);
  const max = Math.max(1, ...rows.list.map(([, e]) => e.n));

  return (
    <Card title="Distribution by zone" subtitle="Last recorded location · click to open on the map">
      {rows.list.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">No location data.</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.list.map(([z, e]) => (
            <li key={z}>
              <Link href={`/map?team=${teamId}&zone=${z}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-ink/[0.04]">
                <span className="w-[118px] shrink-0 truncate text-[13px]">{ZONE_BY_ID[z].name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.05]">
                  <span className="block h-full rounded-full bg-accent-2" style={{ width: `${(e.n / max) * 100}%` }} />
                </span>
                <span className="num w-6 text-right text-[13px] font-semibold">{e.n}</span>
                <span className="num w-9 text-right text-[11px] text-faint">{Math.round((e.n / ids.length) * 100)}%</span>
                <MapPinned size={12} className="text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rows.none > 0 && <p className="mt-2 text-[11px] text-faint">{rows.none} with no recorded location.</p>}
    </Card>
  );
}

function ActivityPanel({ agg, label, span }: { agg: ReturnType<typeof computeActivity>; label: string; span: number }) {
  const byHour = span <= 26 * HOUR;
  return (
    <Card title="Team activity" subtitle={`${label} · recorded hours of its penguins`}>
      {agg.penguinCount === 0 ? (
        <p className="py-4 text-center text-xs text-muted">No penguins assigned.</p>
      ) : (
        <>
          <StackedColumns
            height={150}
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
        </>
      )}
    </Card>
  );
}

function ScheduleSide({ teamId, onAll, className }: { teamId: string; onAll: () => void; className?: string }) {
  const { shifts, now } = useDemo();
  const weekday = new Date(now).getDay();
  const today = shifts.filter((s) => s.teamId === teamId && s.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start));
  return (
    <Card className={className} title="Team schedule (today)" icon={CalendarClock} action={<button onClick={onAll} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">View schedule <ArrowRight size={12} /></button>}>
      {today.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-2 text-center">
          <p className="text-xs text-muted">{shifts.some((s) => s.teamId === teamId) ? "No shifts set up for today." : "No shifts set up for this team."}</p>
          {PERMISSIONS.manageTeams && (
            <button onClick={onAll} className="mt-2 text-xs text-accent hover:underline">
              Set up shifts
            </button>
          )}
        </div>
      ) : (
        <ShiftTimeline shifts={today} compact />
      )}
    </Card>
  );
}

/* ───────────── Penguin table ───────────── */

function PenguinTable({
  teamId,
  ids,
  perPenguin,
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
  state: TableState;
  setState: (s: TableState) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  compact?: boolean;
  rangeLabel: string;
}) {
  const { dataset, snapshots, now } = useDemo();
  const set = (patch: Partial<TableState>) => setState({ ...t, page: "page" in patch ? patch.page! : 1, ...patch });

  type Row = { id: string; name?: string; species: SpeciesId; snap: Snapshot; b?: Breakdown; zone: string };
  const all: Row[] = useMemo(
    () =>
      ids.map((id) => {
        const p = dataset.penguins.find((x) => x.id === id)!;
        const snap = snapshots.get(id)!;
        return { id, name: p.name, species: p.speciesId, snap, b: perPenguin.get(id), zone: snap.reading?.zoneId ?? "" };
      }),
    [ids, dataset, snapshots, perPenguin],
  );
  const zoneOptions = [...new Set(all.map((r) => r.zone).filter(Boolean))].map((z) => ({ value: z, label: ZONE_BY_ID[z].name }));
  const speciesOptions = SPECIES.filter((s) => all.some((r) => r.species === s.id)).map((s) => ({ value: s.id, label: s.nameEn, color: s.color }));

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
      t.sort === "name" ? (r.name ?? "￿") : t.sort === "last" ? (r.snap.reading?.timestamp ?? 0) : t.sort === "water" ? (r.b?.water ?? -1) : t.sort === "land" ? (r.b?.land ?? -1) : r.id;
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
        {compact && <h3 className="mr-2 text-[15px] font-semibold">Team penguins <span className="num text-muted">({rows.length})</span></h3>}
        <div className="flex h-10 min-w-[200px] flex-[2] items-center gap-2 rounded-xl border border-line bg-ink/[0.05] px-3">
          <Search size={14} className="text-muted" />
          <input value={t.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search by ID, name or device…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
        </div>
        <FilterMenu<SpeciesId> className="flex-1" label="Species" allLabel="All" value={t.species} onChange={(v) => set({ species: v })} options={speciesOptions} />
        <FilterMenu className="flex-1" label="Zone" allLabel="All" value={t.zones} onChange={(v) => set({ zones: v })} options={zoneOptions} />
        <FilterMenu<LiveStatus>
          className="flex-1"
          label="Status"
          value={t.status}
          onChange={(v) => set({ status: v })}
          options={(["water", "land", "resting"] as LiveStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s], color: STATUS_COLOR[s] }))}
        />
        {!compact && (
          <FilterMenu<ActivityFilter>
            className="flex-1"
            label="Activity"
            allLabel="All"
            value={t.activity}
            onChange={(v) => set({ activity: v })}
            options={[
              { value: "water", label: "More time in water", color: SERIES.water },
              { value: "land", label: "More time on land", color: SERIES.land },
            ]}
          />
        )}
        {hasFilters && (
          <button onClick={() => setState({ ...EMPTY_TABLE, sort: t.sort, dir: t.dir, per: t.per })} className="inline-flex h-10 items-center gap-1 px-2 text-xs text-muted hover:text-ink">
            <X size={13} /> Clear
          </button>
        )}
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-muted">
              <th className="px-3 py-2.5 font-medium">Photo</th>
              <SortTh k="id" t={t} onSort={sortBy}>ID</SortTh>
              <SortTh k="name" t={t} onSort={sortBy}>Name</SortTh>
              <th className="px-2 py-2.5 font-medium">Species</th>
              <th className="px-2 py-2.5 font-medium">Last recorded zone</th>
              <th className="px-2 py-2.5 font-medium">Status</th>
              <SortTh k="water" t={t} onSort={sortBy} sub={rangeLabel}>In water</SortTh>
              <SortTh k="land" t={t} onSort={sortBy} sub={rangeLabel}>On land</SortTh>
              <SortTh k="last" t={t} onSort={sortBy}>Last reading</SortTh>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const noData = !r.b || r.b.readings === 0;
              return (
                <tr
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  className={cx("cursor-pointer border-b border-line/70 transition last:border-0", selected === r.id ? "bg-accent/[0.08]" : "hover:bg-ink/[0.025]")}
                >
                  <td className="px-3 py-1.5"><PenguinIllustration speciesId={r.species} size={32} /></td>
                  <td className="px-2 py-2 font-mono text-[13px]">{r.id}</td>
                  <td className="px-2 py-2">{r.name ?? <span className="text-faint">Unnamed</span>}</td>
                  <td className="px-2 py-2 text-xs text-muted">{SPECIES_BY_ID[r.species].nameEn}</td>
                  <td className="px-2 py-2">
                    {r.zone ? (
                      <span className="inline-flex rounded-md border border-line-strong px-1.5 py-0.5 text-xs">
                        {ZONE_BY_ID[r.zone].name}
                      </span>
                    ) : (
                      <span className="text-xs text-faint">No data</span>
                    )}
                  </td>
                  <td className="px-2 py-2"><StatusPill status={r.snap.status} compact /></td>
                  <td className="px-2 py-2">{noData ? <span className="text-xs text-faint">No data</span> : <HBar value={r.b!.water} max={maxH} color={SERIES.water} />}</td>
                  <td className="px-2 py-2">{noData ? <span className="text-xs text-faint">No data</span> : <HBar value={r.b!.land} max={maxH} color="#f5b84b" />}</td>
                  <td
                    className="whitespace-nowrap px-2 py-2 text-xs text-muted"
                    title={r.snap.reading ? `${SOURCE_SHORT[r.snap.reading.source]} · ${QUALITY_LABEL[r.snap.reading.quality]} quality (±${r.snap.reading.accuracyM} m)` : undefined}
                  >
                    {r.snap.reading ? (
                      <>
                        {fmtDateTime(r.snap.reading.timestamp, now)}
                        <span className="block text-[10px] text-faint">{QUALITY_LABEL[r.snap.reading.quality]} quality · ±{r.snap.reading.accuracyM} m</span>
                      </>
                    ) : (
                      "No data"
                    )}
                  </td>
                  <td className="pr-3">
                    <Link href={`/penguins/${r.id}`} onClick={(e) => e.stopPropagation()} title="Open profile" className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-ink/5 hover:text-ink">
                      <ChevronRight size={15} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState icon={SearchX} title={ids.length ? "No penguins match" : "This team has no assigned penguins"} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-muted">
        <span>
          Showing {rows.length ? (page - 1) * per + 1 : 0}–{Math.min(page * per, rows.length)} of {rows.length}
          {teamId && compact ? " · click a row to see its summary" : ""}
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
            Rows per page
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
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium"><ArrowRightLeft size={13} className="text-accent" /> Reassign to another team</p>
      <Select
        value={target}
        onChange={(e) => {
          setTarget(e.target.value);
          setConfirming(false);
        }}
        className="h-8 w-full text-xs"
      >
        <option value="">Choose destination team…</option>
        {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
      {to && !confirming && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setConfirming(true)}>Review change</Button>
      )}
      {to && confirming && (
        <div className="mt-2 rounded-lg border border-accent/30 bg-accent/5 p-2.5 text-xs">
          <p>
            <span className="font-mono">{p.id}</span>{p.name ? ` · ${p.name}` : ""}
          </p>
          <p className="mt-1.5 flex items-center gap-2">
            <span className="rounded-md bg-ink/[0.06] px-1.5 py-0.5">{from?.name ?? "Unassigned"}</span>
            <ArrowRight size={13} className="text-accent" />
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-ink">{to.name}</span>
          </p>
          <p className="mt-1.5 text-[11px] text-faint">It is kept in the history and reflected in Species, Penguins and Habitat Map.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                reassign(penguinId, to.id);
                onDone();
              }}
            >
              Confirm reassignment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── Schedule ───────────── */

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
              <span className="relative h-6 flex-1 rounded-md bg-ink/[0.03]">
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
  const shiftName = (start: string) => {
    const h = Number(start.split(":")[0]);
    return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Night";
  };

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="panel p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setWeekday((weekday + 6) % 7)} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:text-ink"><ChevronLeft size={15} /></button>
          <p className="min-w-[110px] text-center text-sm font-semibold">{WEEKDAYS[weekday]}</p>
          <button onClick={() => setWeekday((weekday + 1) % 7)} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:text-ink"><ChevronRight size={15} /></button>
          {weekday !== new Date(now).getDay() && <button onClick={() => setWeekday(new Date(now).getDay())} className="text-xs text-accent hover:underline">Today</button>}
          {PERMISSIONS.manageTeams && (
            <Button size="sm" variant="primary" className="ml-auto" onClick={() => setShowForm(true)}><Plus size={14} /> Set up shift</Button>
          )}
        </div>
        {mine.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No shifts set up" action={PERMISSIONS.manageTeams ? <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>Set up shifts</Button> : undefined}>
            No staff schedules recorded yet. Once they are recorded, they will appear here by day.
          </EmptyState>
        ) : day.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">No shifts set up for {WEEKDAYS[weekday]}.</p>
        ) : (
          <>
            <ShiftTimeline shifts={day} />
            <table className="mt-5 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Role</th>
                  <th className="py-2 font-medium">Shift</th>
                  <th className="py-2 font-medium">Start</th>
                  <th className="py-2 font-medium">End</th>
                  <th className="py-2 font-medium">Availability</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {day.map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0">
                    <td className="py-2">{s.member}</td>
                    <td className="py-2 text-xs text-muted">{s.member === team.lead ? "Team lead" : team.roles?.[s.member] || "No role on record"}</td>
                    <td className="py-2 text-xs">{shiftName(s.start)}</td>
                    <td className="py-2 font-mono text-xs">{s.start}</td>
                    <td className="py-2 font-mono text-xs">{s.end}</td>
                    <td className="py-2"><Badge tone={s.availability === "available" ? "ok" : s.availability === "partial" ? "warn" : "neutral"}>{AVAIL_LABEL[s.availability]}</Badge></td>
                    <td className="py-2 text-right">
                      {PERMISSIONS.manageTeams && (
                        <button onClick={() => removeShift(s.id)} className="rounded-lg p-1.5 text-faint hover:bg-ink/5 hover:text-danger" title="Remove shift"><Trash2 size={14} /></button>
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
        <Card title="Week" icon={CalendarClock} subtitle="Shifts set up per day">
          <ul className="space-y-1">
            {WEEKDAYS.map((d, i) => {
              const n = mine.filter((s) => s.weekday === i).length;
              return (
                <li key={d}>
                  <button onClick={() => setWeekday(i)} className={cx("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm", i === weekday ? "bg-accent/10 text-ink" : "text-muted hover:bg-ink/[0.04]")}>
                    {d}
                    <span className="num text-xs text-faint">{n ? `${n} shift${n === 1 ? "" : "s"}` : "—"}</span>
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
  const field = "mt-1 w-full rounded-xl border border-line-strong bg-ink/[0.05] px-3 py-2 text-sm outline-none focus:border-accent/60 [color-scheme:dark]";
  return (
    <Card title="Set up shift" icon={CalendarClock} action={<button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-ink"><X size={15} /></button>}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd({ teamId: team.id, member, weekday: day, start, end, availability });
          setSaved(true);
        }}
      >
        <label className="block text-xs text-muted">
          Member
          <select value={member} onChange={(e) => (setMember(e.target.value), setSaved(false))} className={field}>
            {team.members.map((m) => <option key={m} value={m} className="bg-panel-solid">{m}</option>)}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Day
          <select value={day} onChange={(e) => (setDay(Number(e.target.value)), setSaved(false))} className={field}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i} className="bg-panel-solid">{d}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-muted">
            Start
            <input type="time" value={start} onChange={(e) => (setStart(e.target.value), setSaved(false))} className={field} />
          </label>
          <label className="block text-xs text-muted">
            End
            <input type="time" value={end} onChange={(e) => (setEnd(e.target.value), setSaved(false))} className={field} />
          </label>
        </div>
        <label className="block text-xs text-muted">
          Availability
          <select value={availability} onChange={(e) => setAvailability(e.target.value as Shift["availability"])} className={field}>
            {(Object.keys(AVAIL_LABEL) as Shift["availability"][]).map((k) => <option key={k} value={k} className="bg-panel-solid">{AVAIL_LABEL[k]}</option>)}
          </select>
        </label>
        <div className="flex items-center justify-between">
          {saved ? <span className="text-xs text-ok">Shift saved.</span> : <span />}
          <Button type="submit" variant="primary" size="sm" disabled={!member || start >= end}>Save shift</Button>
        </div>
        {start >= end && <p className="text-[11px] text-danger">End time must be after start time.</p>}
      </form>
    </Card>
  );
}

/* ───────────── Staff ───────────── */

function StaffTab({ teamId }: { teamId: string }) {
  const { dataset, shifts, teamLog, updateTeam, now } = useDemo();
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
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-2 py-2.5 font-medium">Role</th>
                <th className="px-2 py-2.5 font-medium">Assignment</th>
                <th className="px-2 py-2.5 font-medium">Scheduled shift</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {team.members.map((m) => {
                const isLead = m === team.lead;
                const myShifts = shifts.filter((s) => s.teamId === teamId && s.member === m);
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
                        <Badge tone="accent">Team lead</Badge>
                      ) : can ? (
                        <input
                          defaultValue={team.roles?.[m] ?? ""}
                          placeholder="No role on record"
                          onBlur={(e) => e.target.value.trim() !== (team.roles?.[m] ?? "") && updateTeam(teamId, { roles: { ...team.roles, [m]: e.target.value.trim() } })}
                          className="h-8 w-44 rounded-lg border border-line bg-ink/[0.05] px-2 text-xs outline-none placeholder:text-faint focus:border-accent/60"
                        />
                      ) : (
                        <span className="text-xs text-muted">{team.roles?.[m] || "No role on record"}</span>
                      )}
                    </td>
                    <td className="px-2 py-2"><Badge tone="ok">Active on team</Badge></td>
                    <td className="px-2 py-2 text-xs text-muted">
                      {myShifts.length ? myShifts.map((s) => `${WEEKDAYS[s.weekday].slice(0, 3)} ${s.start}–${s.end}`).join(" · ") : <span className="text-faint">No shift set up</span>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {can && !isLead &&
                        (removing === m ? (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            Remove?
                            <Button size="sm" variant="danger" onClick={() => (updateTeam(teamId, { members: team.members.filter((x) => x !== m) }), setRemoving(null))}>Yes</Button>
                            <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>No</Button>
                          </span>
                        ) : (
                          <button onClick={() => setRemoving(m)} className="rounded-lg p-1.5 text-faint hover:bg-ink/5 hover:text-danger" title="Remove from team"><Trash2 size={14} /></button>
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
              New member
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="First and last name" className="mt-1 block h-9 w-56 rounded-xl border border-line-strong bg-ink/[0.05] px-3 text-sm outline-none focus:border-accent/60" />
            </label>
            <label className="text-xs text-muted">
              Role
              <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Optional" className="mt-1 block h-9 w-44 rounded-xl border border-line-strong bg-ink/[0.05] px-3 text-sm outline-none focus:border-accent/60" />
            </label>
            <Button type="submit" variant="primary" disabled={!newName.trim() || team.members.includes(newName.trim())}>
              <UserPlus size={14} /> Add
            </Button>
            <span className="text-[11px] text-faint">The team lead is changed from “Edit team”.</span>
          </form>
        )}
      </section>
      <Card title="Team history" icon={History} subtitle="Changes to members, roles, status and shifts">
        {history.length === 0 ? (
          <p className="py-3 text-xs text-muted">No changes recorded.</p>
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

/* ───────────── helpers ───────────── */

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
      <span className="h-2 w-14 overflow-hidden rounded-full bg-ink/[0.05]">
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
      className={cx("grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs transition disabled:opacity-30", active ? "border border-accent/50 bg-accent/10 text-ink" : "text-muted hover:bg-ink/5 hover:text-ink")}
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

