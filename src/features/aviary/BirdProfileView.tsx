"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowRightLeft, ChevronDown, ChevronRight, HeartPulse, History, ListOrdered, MapPin, MapPinned, NotebookPen, Radio, SearchX, Stethoscope, TreePine, Users } from "lucide-react";
import {
  DEVICE_STATUS_LABEL,
  FIX_STATUS,
  LEVELS,
  LOCATION_KIND,
  MONITOR_ZONE_BY_ID,
  SIGNAL_LABEL,
  levelOf,
  type MonitorBird,
  type Vec3,
} from "@/domain/aviaryTracking";
import { FOLLOW_KIND_LABEL } from "@/domain/aviaryCare";
import { MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { SPECIES_INFO } from "@/data/aviarySpeciesInfo";
import { MONITOR_TEAMS, MONITOR_TEAM_BY_ID, defaultTeam, type TeamId } from "@/data/aviaryTeams";
import { activityBreakdown, flightByDay, flightStats, fmtDistance } from "@/logic/aviaryActivity";
import { dataQuality, fmtHeight, historyRows } from "@/logic/aviaryTracking";
import { DAY, HOUR, MIN, fmtAgo, fmtDate, fmtDateTime, fmtHours, fmtTime, fmtWeekday, startOfDay } from "@/logic/time";
import { useAviaryCare } from "@/state/useAviaryCare";
import { useTeamAssignments } from "@/state/useTeams";
import { Badge, Button, Card, EmptyState, Segmented, Select, cx } from "@/components/ui/primitives";
import { BarList, SplitBar, StackedColumns } from "@/components/charts/Charts";
import { Compare, Kpi, MetricBlock, Row } from "@/features/penguins/PenguinProfileView";
import { DEFAULT_SCENE_LAYERS } from "./monitor/AviaryScene";
import { AviaryImageMap } from "./monitor/AviaryImageMap";
import { BirdHealth } from "./care/BirdFollowUps";
import { useAviarySnapshot } from "./common";

/** Colours of the bird activity states, as in the bird card on the map. */
const C = { flying: "#2563eb", walking: "#c7850c", perched: "#16a34a", ground: "#9fb4c7" };
const STATUS_TONE = { detected: "ok", moving: "info", stale: "warn", "no-signal": "danger" } as const;

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "health", label: "Health" },
  { id: "location", label: "Location" },
  { id: "activity", label: "Activity" },
  { id: "readings", label: "Detections" },
  { id: "team", label: "Team" },
  { id: "history", label: "History" },
  { id: "care", label: "Care" },
];

type PeriodId = "24h" | "7d";
const PERIODS: Record<PeriodId, { ms: number; label: string }> = { "24h": { ms: DAY, label: "Last 24 h" }, "7d": { ms: 7 * DAY, label: "Last 7 days" } };

/** Individual profile of a bird: the penguin profile, with flight instead of water. */
export function BirdProfileView() {
  const { id } = useParams<{ id: string }>();
  const { birdById } = useAviarySnapshot();
  const bird = birdById.get(decodeURIComponent(id ?? ""));
  if (!bird) {
    return (
      <div className="p-8">
        <Card>
          <EmptyState icon={SearchX} title={`Bird ${id} not found`} action={<Link href="/aviary/birds" className="text-sm text-accent hover:underline">Go to the individuals</Link>}>
            The registry may have been regenerated.
          </EmptyState>
        </Card>
      </div>
    );
  }
  return <Profile key={bird.id} bird={bird} />;
}

function Profile({ bird }: { bird: MonitorBird }) {
  const { ds, registry, asOf, fixes } = useAviarySnapshot();
  const { teamOf } = useTeamAssignments(registry);
  const [period, setPeriod] = useState<PeriodId>("24h");
  const sp = MONITOR_SPECIES_BY_ID[bird.speciesId];
  const fix = fixes.get(bird.id)!;
  const det = fix.det;
  const team = MONITOR_TEAM_BY_ID[teamOf(bird)];
  const from = Math.max(ds.windowStart, asOf - PERIODS[period].ms);
  const stays = useMemo(() => ds.stays.get(bird.id) ?? [], [ds, bird.id]);
  const s = useMemo(() => flightStats(bird, stays, from, asOf), [bird, stays, from, asOf]);
  const title = bird.name ?? bird.id;

  return (
    <div className="pb-10">
      <div className="px-6 pt-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted">
          <Link href="/aviary/species" className="hover:text-ink">Species</Link>
          <ChevronRight size={12} className="text-faint" />
          <Link href={`/aviary/species/${sp.id}`} className="hover:text-ink">{sp.common}</Link>
          <ChevronRight size={12} className="text-faint" />
          <span className="text-ink">{title}</span>
        </nav>
      </div>

      <div id="overview" className="mx-6 mt-3 scroll-mt-20 lg:mx-8">
        <div className="panel relative overflow-hidden p-5">
          <div className="absolute inset-y-0 right-0 w-2/3 opacity-[0.07]" style={{ background: `radial-gradient(circle at 85% 30%, ${sp.color}, transparent 65%)` }} />
          <div className="relative flex flex-wrap items-start gap-5">
            <figure className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SPECIES_INFO[sp.code].photo.src} alt={sp.common} className="h-[116px] w-[116px] rounded-2xl object-cover" />
              <figcaption className="mt-1 max-w-[116px] text-center text-[10px] leading-tight text-faint">Representative image of the species</figcaption>
            </figure>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Individual profile</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                {/* Most birds have no name: the ID is then the title. */}
                <h1 className={cx("text-[30px] font-semibold leading-tight tracking-tight", !bird.name && "font-mono")}>{bird.name ?? bird.id}</h1>
                {bird.name && <span className="font-mono text-lg text-muted">{bird.id}</span>}
              </div>
              <p className="mt-1 text-sm">
                {sp.common} <span className="text-muted">·</span> <i className="text-muted">{sp.scientific}</i>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[fix.status]}>{FIX_STATUS[fix.status].label}</Badge>
                <Badge tone={dataQuality(fix).tone}>Quality: {dataQuality(fix).label}</Badge>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/[0.05] px-2 py-0.5 text-[11px] text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: team.color }} /> {team.name}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/[0.05] px-2 py-0.5 text-[11px] text-muted">
                  <MapPin size={11} />
                  {det?.zoneId ? `${MONITOR_ZONE_BY_ID[det.zoneId].name}${det.treeId ? ` · ${det.treeId}` : ""} · ${fmtDateTime(det.at, asOf)}` : "No location recorded"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link href={`/aviary/species/${sp.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm text-ink hover:border-accent/50">
                <ArrowLeft size={14} /> Species
              </Link>
              <Link href={`/aviary/map?bird=${bird.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white hover:bg-[#0b8178]">
                <MapPinned size={15} /> View on map
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-20 mt-4 border-y border-line bg-bg/85 px-6 backdrop-blur lg:px-8">
        <div className="scroll-thin flex items-center gap-1 overflow-x-auto py-2">
          {SECTIONS.map((x) => (
            <a key={x.id} href={`#${x.id}`} className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-muted hover:bg-ink/5 hover:text-ink">
              {x.label}
            </a>
          ))}
          <span className="ml-auto pl-3">
            <Segmented size="sm" value={period} onChange={setPeriod} options={[{ value: "24h", label: "24 h" }, { value: "7d", label: "7 days" }]} />
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-5 px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Last location" value={det?.zoneId ? `${MONITOR_ZONE_BY_ID[det.zoneId].name}${det.treeId ? ` · ${det.treeId}` : ""}` : "No data"} sub={det?.pos ? `${fmtHeight(det.pos.y)} · ${levelOf(det.pos.y).label}` : det?.kind === "zone" ? "Zone only" : undefined} small />
          <Kpi label="Time flying" value={s.measurable ? fmtDur(s.flyingMs) : "Not available"} sub={`${PERIODS[period].label} · ${s.flights} flights`} color={C.flying} />
          <Kpi label="Time perched in trees" value={s.measurable ? fmtHours(s.perchedMs) : "Not available"} sub={PERIODS[period].label} color={C.perched} />
          <Kpi label="Last detection" value={det ? fmtDateTime(det.at, asOf) : "No data"} sub={det ? `${fmtAgo(det.at, asOf)} · ${det.source[0].toUpperCase() + det.source.slice(1)}` : undefined} small />
        </div>

        <Card title={<span id="health" className="scroll-mt-20">Health</span>} icon={HeartPulse}>
          <BirdHealth birdId={bird.id} />
        </Card>

        <LocationSection bird={bird} from={from} periodLabel={PERIODS[period].label} />
        <ActivitySection bird={bird} from={from} periodLabel={PERIODS[period].label} />
        <DetectionsSection bird={bird} from={from} />

        <div className="grid gap-5 xl:grid-cols-12">
          <TeamSection bird={bird} className="xl:col-span-5" />
          <TimelineSection bird={bird} from={from} periodLabel={PERIODS[period].label} className="xl:col-span-7" />
        </div>

        <CareSection bird={bird} />
      </div>
    </div>
  );
}

const fmtDur = (ms: number) => (ms >= HOUR ? fmtHours(ms) : ms >= MIN ? `${Math.round(ms / MIN)} min` : `${Math.round(ms / 1000)} s`);

/* ───────────── Location ───────────── */

function LocationSection({ bird, from, periodLabel }: { bird: MonitorBird; from: number; periodLabel: string }) {
  const { registry, src, asOf, fixes } = useAviarySnapshot();
  const sp = MONITOR_SPECIES_BY_ID[bird.speciesId];
  const fix = fixes.get(bird.id)!;
  const det = fix.det;
  const zoneOnly = bird.device.status === "intermittent";
  const trail: Vec3[] | null = useMemo(
    () => (zoneOnly ? null : src.history(bird.id, asOf - DAY, asOf).filter((x) => x.start <= asOf).map((x) => x.pos)),
    [zoneOnly, src, bird.id, asOf],
  );
  // Arrivals at a new tree in the period: the bird's movements.
  const moves = useMemo(() => {
    const rows = historyRows(bird, src.history(bird.id, from, asOf), asOf);
    return rows.filter((r, i) => i === rows.length - 1 || r.treeId !== rows[i + 1].treeId || r.zoneId !== rows[i + 1].zoneId);
  }, [bird, src, from, asOf]);

  return (
    <Card
      title={<span id="location" className="scroll-mt-20">Location and movement history</span>}
      icon={MapPinned}
      subtitle="Path over the last 24 h, drawn on the aviary picture. Positions on the picture are approximate."
      action={
        <Link href={`/aviary/map?bird=${bird.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line-strong px-2.5 text-xs text-ink hover:border-accent/50">
          <MapPinned size={13} /> View on the map
        </Link>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_280px_300px]">
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-line bg-ink/[0.05]">
          {det?.pos ? (
            <AviaryImageMap
              trees={registry.trees}
              points={[{ id: bird.id, pos: det.pos, color: sp.color, dim: false, label: `${bird.id} · ${sp.common}` }]}
              selectedBirdId={bird.id}
              selectedTreeId={null}
              highlightZoneId={null}
              precision={det.precisionM ? { pos: det.pos, r: det.precisionM } : null}
              trail={trail}
              focus={{ pos: det.pos, key: 1 }}
              layers={{ ...DEFAULT_SCENE_LAYERS, labels: false }}
              onSelectBird={() => {}}
              onSelectTree={() => {}}
              onSelectZone={() => {}}
            />
          ) : (
            <EmptyState icon={MapPinned} title={det?.kind === "zone" ? `Zone only: ${det.zoneId ? MONITOR_ZONE_BY_ID[det.zoneId].name : "—"}` : "No location recorded"}>
              {det?.kind === "zone" ? "The tag only reports the zone, so no position is drawn." : undefined}
            </EmptyState>
          )}
        </div>
        <dl className="space-y-2.5 text-sm">
          <Row k="Zone · tree" v={det?.zoneId ? `${MONITOR_ZONE_BY_ID[det.zoneId].code} · ${MONITOR_ZONE_BY_ID[det.zoneId].name}${det.treeId ? ` · ${det.treeId}` : ""}` : "No data"} />
          <Row k="Estimated height" v={det?.pos ? `${fmtHeight(det.pos.y)} · ${levelOf(det.pos.y).label}` : "Not available"} />
          <Row k="Date and time" v={det ? `${fmtDateTime(det.at, asOf)} · ${fmtAgo(det.at, asOf)}` : "No data"} />
          <Row k="Location type" v={LOCATION_KIND[det?.kind ?? "unknown"].label} />
          <Row k="Precision · confidence" v={det ? `${det.precisionM != null ? `± ${det.precisionM.toFixed(1)} m` : "zone level"} · ${Math.round(det.confidence * 100)}%` : "—"} />
          <Row k="Signal" v={det ? SIGNAL_LABEL[fix.status === "no-signal" ? "none" : det.signal] : "None"} />
          <Row k="Device" v={<span className="font-mono">{bird.device.id}</span>} />
          <Row k="Device status" v={`${DEVICE_STATUS_LABEL[bird.device.status]} · ${bird.device.batteryPct}%`} />
        </dl>
        <div>
          <p className="mb-2 text-xs font-medium">Tree and zone changes · {periodLabel.toLowerCase()}</p>
          <ol className="scroll-thin max-h-[330px] space-y-1 overflow-y-auto pr-1">
            {moves.length === 0 && <li className="py-4 text-center text-xs text-muted">No movements in this period.</li>}
            {moves.slice(0, 60).map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs odd:bg-ink/[0.025]">
                <span className="num w-[86px] shrink-0 text-muted">{fmtDate(m.start)} {fmtTime(m.start)}</span>
                <span className="truncate text-ink">
                  {MONITOR_ZONE_BY_ID[m.zoneId].code}
                  {m.treeId ? ` · ${m.treeId}` : ""}
                  {m.heightM != null ? ` · ${m.heightM.toFixed(1)} m` : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}

/* ───────────── Activity ───────────── */

function ActivitySection({ bird, from, periodLabel }: { bird: MonitorBird; from: number; periodLabel: string }) {
  const { ds, asOf } = useAviarySnapshot();
  const stays = useMemo(() => ds.stays.get(bird.id) ?? [], [ds, bird.id]);
  const span = asOf - from;
  const s = useMemo(() => flightStats(bird, stays, from, asOf), [bird, stays, from, asOf]);
  const prev = useMemo(() => (from - span >= ds.windowStart ? flightStats(bird, stays, from - span, from) : null), [bird, stays, from, span, ds.windowStart]);
  const br = useMemo(() => activityBreakdown(bird, stays, from, asOf), [bird, stays, from, asOf]);
  const days = useMemo(() => flightByDay(bird, stays, ds.windowStart, asOf), [bird, stays, ds.windowStart, asOf]);
  const daily = useMemo(
    () =>
      days.map((d) => {
        const x = activityBreakdown(bird, stays, Math.max(d.day, ds.windowStart), Math.min(d.day + DAY, asOf));
        const sum = (k: "flying" | "walking" | "perched" | "ground") => x.hourly.reduce((a, h) => a + h[k], 0);
        return { day: d.day, flying: sum("flying"), walking: sum("walking"), perched: sum("perched"), ground: sum("ground") };
      }),
    [days, bird, stays, ds.windowStart, asOf],
  );
  const still = s.perchedMs + s.groundMs;
  const moving = s.flyingMs + s.walkingMs;

  if (!s.measurable) {
    return (
      <Card title={<span id="activity" className="scroll-mt-20">Activity</span>} icon={Activity} subtitle={periodLabel}>
        <p className="rounded-lg bg-warn/[0.08] px-3 py-2.5 text-xs text-ink">
          This tag only reports the zone: there are no positions, so flight time, distances and heights are not available. No figures are invented.
        </p>
      </Card>
    );
  }

  return (
    <Card title={<span id="activity" className="scroll-mt-20">Activity</span>} icon={Activity} subtitle={`${periodLabel} · time worked out from the detections and the trips between them.`}>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBlock label="Flying" value={fmtDur(s.flyingMs)} sub={`${s.flights} flights · ${fmtDistance(s.flownM)}`} color={C.flying} />
        <MetricBlock label="Perched in trees" value={fmtHours(s.perchedMs)} sub={`${s.treesVisited} trees · ${s.zonesVisited} zones visited`} color={C.perched} />
        <MetricBlock label="No movement detected" value={fmtHours(still)} sub="Perched or on the ground, same spot" color={C.ground} />
        <MetricBlock label="Moving" value={fmtDur(moving)} sub={`Flying plus walking (${fmtDistance(s.walkedM)} walked)`} color={C.walking} />
      </div>
      <SplitBar
        className="mt-4"
        title="Time in the period"
        parts={[
          { value: s.flyingMs, color: C.flying, label: "Flying" },
          { value: s.walkingMs, color: C.walking, label: "Walking" },
          { value: s.perchedMs, color: C.perched, label: "Perched in trees" },
          { value: s.groundMs, color: C.ground, label: "On the ground" },
        ]}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div>
          <p className="mb-3 text-xs text-muted">Activity by hour of day · minutes moving</p>
          <StackedColumns
            height={140}
            labelEvery={6}
            format={(v) => `${Math.round(v / MIN)} min`}
            series={[
              { key: "flying", color: C.flying, label: "Flying" },
              { key: "walking", color: C.walking, label: "Walking" },
            ]}
            data={br.hourly.map((h, i) => ({ label: `${i}h`, tooltip: `${String(i).padStart(2, "0")}:00`, values: { flying: h.flying, walking: h.walking } }))}
          />
        </div>
        <div>
          <p className="mb-3 text-xs text-muted">Minutes flying per day · last {daily.length} days</p>
          <StackedColumns
            height={140}
            labelEvery={1}
            format={(v) => `${Math.round(v / MIN)} min`}
            series={[
              { key: "flying", color: C.flying, label: "Flying" },
              { key: "walking", color: C.walking, label: "Walking" },
            ]}
            data={daily.map((d) => ({ label: String(new Date(d.day).getDate()), tooltip: fmtWeekday(d.day), values: { flying: d.flying, walking: d.walking } }))}
          />
        </div>
        <div>
          <p className="mb-3 text-xs text-muted">Time at each height level · estimated</p>
          <BarList
            format={(v) => fmtHours(v)}
            items={LEVELS.map((l) => ({ key: l.id, label: l.label, value: br.levels.get(l.id) ?? 0, color: C.perched }))}
          />
          <p className="mt-1 text-[11px] text-faint">Highest point {s.maxHeightM.toFixed(1)} m · {br.treeChanges} tree changes</p>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-line p-4">
        <p className="mb-2 text-xs font-medium">Compared with the previous period of equal length</p>
        {prev ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Compare label="Flying" cur={s.flyingMs} prev={prev.flyingMs} />
            <Compare label="Perched in trees" cur={s.perchedMs} prev={prev.perchedMs} />
            <Compare label="No movement" cur={still} prev={prev.perchedMs + prev.groundMs} />
          </div>
        ) : (
          <p className="text-xs text-muted">Not enough data: the history does not keep a complete previous period.</p>
        )}
        <p className="mt-2 text-[11px] text-faint">
          Detected: a position from the tag. Inferred: flying and walking are the trips between two detected places; “no movement” is time at one place. A change in activity does not by itself imply any health condition.
        </p>
      </div>
    </Card>
  );
}

/* ───────────── Detections ───────────── */

function DetectionsSection({ bird, from }: { bird: MonitorBird; from: number }) {
  const { src, asOf } = useAviarySnapshot();
  const [newest, setNewest] = useState(true);
  const [limit, setLimit] = useState(25);
  const rows = useMemo(() => {
    const list = historyRows(bird, src.history(bird.id, from, asOf), asOf).map((r) => ({ r, det: src.latest(bird.id, Math.max(r.start, Math.min(r.end, asOf))) }));
    return newest ? list : [...list].reverse();
  }, [bird, src, from, asOf, newest]);

  return (
    <Card
      title={<span id="readings" className="scroll-mt-20">Detection history</span>}
      icon={ListOrdered}
      subtitle={`${rows.length} ${rows.length === 1 ? "location" : "locations"} in the period. Each row is a place where the tag kept detecting the bird; nothing is filled in.`}
      action={
        <Button size="sm" variant="outline" onClick={() => setNewest((v) => !v)}>
          {newest ? "Newest first" : "Oldest first"}
        </Button>
      }
    >
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-muted">
              <th className="py-2 pr-3 font-medium">From – to</th>
              <th className="py-2 pr-3 font-medium">Zone · tree</th>
              <th className="py-2 pr-3 font-medium">Height · level</th>
              <th className="py-2 pr-3 font-medium">Location type</th>
              <th className="py-2 pr-3 font-medium">Precision</th>
              <th className="py-2 pr-3 font-medium">Confidence</th>
              <th className="py-2 font-medium">Device</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map(({ r, det }) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0">
                <td className="whitespace-nowrap py-2 pr-3 text-xs">
                  {fmtDateTime(r.start, asOf)} – {fmtTime(Math.min(r.end, asOf))}
                </td>
                <td className="py-2 pr-3 text-xs">
                  {MONITOR_ZONE_BY_ID[r.zoneId].code} · {MONITOR_ZONE_BY_ID[r.zoneId].name}
                  {r.treeId ? <span className="ml-1 font-medium">· {r.treeId}</span> : null}
                </td>
                <td className="py-2 pr-3 text-xs">{r.heightM != null ? `${r.heightM.toFixed(1)} m · ${levelOf(r.heightM).short}` : <span className="text-faint">Not available</span>}</td>
                <td className="py-2 pr-3 text-xs text-muted">{LOCATION_KIND[r.kind].label}</td>
                <td className="py-2 pr-3 text-xs">{det?.precisionM != null ? `± ${det.precisionM.toFixed(1)} m` : <span className="text-faint">Zone level</span>}</td>
                <td className="py-2 pr-3 text-xs">
                  {det ? <Badge tone={det.confidence >= 0.8 ? "ok" : det.confidence >= 0.6 ? "info" : "warn"}>{Math.round(det.confidence * 100)}%</Badge> : "—"}
                </td>
                <td className="py-2 font-mono text-[11px] text-muted">{bird.device.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-6 text-center text-xs text-muted">No detections in this period.</p>}
      </div>
      {rows.length > limit && (
        <button onClick={() => setLimit((l) => l + 50)} className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ChevronDown size={13} /> Show more ({rows.length - limit} remaining)
        </button>
      )}
    </Card>
  );
}

/* ───────────── Team ───────────── */

function TeamSection({ bird, className }: { bird: MonitorBird; className?: string }) {
  const { registry } = useAviarySnapshot();
  const { teamOf, assign } = useTeamAssignments(registry);
  const team = MONITOR_TEAM_BY_ID[teamOf(bird)];
  const initial = MONITOR_TEAM_BY_ID[defaultTeam(bird, registry)];
  return (
    <Card className={className} title={<span id="team" className="scroll-mt-20">Responsible team</span>} icon={Users}>
      <div className="rounded-xl border border-line p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${team.color}22`, color: team.color }}>
            <Users size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{team.name}</p>
            <p className="text-xs text-muted">Aviary monitoring</p>
          </div>
          <Link href={`/aviary/teams/${team.id}`} className="text-xs text-accent hover:underline">View team</Link>
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <Row k="Team lead" v={team.lead} />
          <Row k="Members" v={team.members.length} />
        </dl>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-[11px] text-muted">Reassign (the change applies across the aviary screens)</p>
        <Select value={team.id} onChange={(e) => assign(bird, e.target.value as TeamId)} className="h-9 w-full">
          {MONITOR_TEAMS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.id === team.id ? " (current)" : ""}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-5">
        <p className="eyebrow mb-2">Assignment history</p>
        <ol className="space-y-2 text-xs">
          {team.id !== initial.id && (
            <li className="flex gap-2">
              <ArrowRightLeft size={13} className="mt-0.5 shrink-0 text-accent" />
              <p>Reassigned from {initial.name} to {team.name}</p>
            </li>
          )}
          <li className="flex gap-2">
            <Users size={13} className="mt-0.5 shrink-0 text-faint" />
            <div>
              <p>Initial assignment: {initial.name}</p>
              <p className="text-[11px] text-faint">Split of the 500 birds into ten teams of 50</p>
            </div>
          </li>
        </ol>
      </div>
    </Card>
  );
}

/* ───────────── History ───────────── */

type EventKind = "tree" | "zone" | "readings" | "followup" | "note";
const EVENT_LABEL: Record<EventKind, string> = { tree: "Tree change", zone: "Zone change", readings: "Detections", followup: "Follow-up", note: "Observation" };
const EVENT_ICON: Record<EventKind, typeof MapPin> = { tree: TreePine, zone: MapPin, readings: Radio, followup: HeartPulse, note: NotebookPen };

function TimelineSection({ bird, from, periodLabel, className }: { bird: MonitorBird; from: number; periodLabel: string; className?: string }) {
  const { ds, src, asOf } = useAviarySnapshot();
  const { cases, notes } = useAviaryCare(ds);
  const [kinds, setKinds] = useState<EventKind[]>([]);
  const [limit, setLimit] = useState(30);

  const events = useMemo(() => {
    const out: { at: number; kind: EventKind; text: string }[] = [];
    const list = src.history(bird.id, from, asOf).filter((x) => x.start <= asOf);
    const zoneOnly = bird.device.status === "intermittent";
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], c = list[i];
      if (a.zoneId !== c.zoneId) out.push({ at: c.start, kind: "zone", text: `${MONITOR_ZONE_BY_ID[a.zoneId].name} → ${MONITOR_ZONE_BY_ID[c.zoneId].name}` });
      else if (!zoneOnly && a.treeId !== c.treeId) out.push({ at: c.start, kind: "tree", text: `${a.treeId} → ${c.treeId} · ${c.pos.y.toFixed(1)} m` });
    }
    const perDay = new Map<number, number>();
    for (const x of list) perDay.set(startOfDay(x.start), (perDay.get(startOfDay(x.start)) ?? 0) + 1);
    for (const [d, n] of perDay) out.push({ at: Math.min(d + DAY - MIN, asOf), kind: "readings", text: `${n} ${n === 1 ? "location" : "locations"} detected on ${fmtDate(d)}` });
    for (const c of cases.filter((x) => x.birdId === bird.id)) for (const e of c.entries) out.push({ at: e.at, kind: "followup", text: `${FOLLOW_KIND_LABEL[c.kind]}: ${e.text}` });
    for (const n of notes.filter((x) => x.birdId === bird.id)) out.push({ at: n.at, kind: "note", text: `${n.by}: ${n.text}` });
    return out.filter((e) => e.at <= asOf + HOUR).sort((a, b) => b.at - a.at);
  }, [bird, src, from, asOf, cases, notes]);

  const shown = kinds.length ? events.filter((e) => kinds.includes(e.kind)) : events;
  return (
    <Card className={className} title={<span id="history" className="scroll-mt-20">Change history</span>} icon={History} subtitle={`Trees, zones and detections: ${periodLabel.toLowerCase()}. Follow-ups and observations: full record.`}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(EVENT_LABEL) as EventKind[]).map((k) => {
          const on = kinds.includes(k);
          return (
            <button
              key={k}
              onClick={() => setKinds(on ? kinds.filter((x) => x !== k) : [...kinds, k])}
              className={cx("rounded-full border px-2.5 py-0.5 text-[11px] transition", on ? "border-accent/50 bg-accent/12 text-ink" : "border-line-strong text-muted hover:text-ink")}
            >
              {EVENT_LABEL[k]}
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">No events.</p>
      ) : (
        <ol className="scroll-thin relative max-h-[440px] space-y-1 overflow-y-auto pr-1 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-line-strong">
          {shown.slice(0, limit).map((e, i) => {
            const Icon = EVENT_ICON[e.kind];
            return (
              <li key={i} className="relative flex gap-3 px-1 py-1.5">
                <span className="z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line-strong bg-panel-solid">
                  <Icon size={13} className="text-accent" />
                </span>
                <div className="min-w-0 text-xs">
                  <p className="text-ink">{e.text}</p>
                  <p className="text-[11px] text-faint">
                    {EVENT_LABEL[e.kind]} · {fmtDateTime(e.at, asOf)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {shown.length > limit && (
        <button onClick={() => setLimit((l) => l + 40)} className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ChevronDown size={13} /> Show more ({shown.length - limit})
        </button>
      )}
    </Card>
  );
}

/* ───────────── Care ───────────── */

function CareSection({ bird }: { bird: MonitorBird }) {
  const { ds, asOf } = useAviarySnapshot();
  const { cases, notes, addNote } = useAviaryCare(ds);
  const [text, setText] = useState("");
  const mine = notes.filter((n) => n.birdId === bird.id).sort((a, b) => b.at - a.at);
  const incidents = cases.filter((c) => c.birdId === bird.id && c.kind === "incident");
  const nextReview = cases.filter((c) => c.birdId === bird.id && c.status === "open" && c.nextReviewAt !== undefined).sort((a, b) => a.nextReviewAt! - b.nextReviewAt!)[0];

  return (
    <Card title={<span id="care" className="scroll-mt-20">Care and observations</span>} icon={NotebookPen}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          addNote(bird.id, text.trim(), asOf);
          setText("");
        }}
        className="mb-5 rounded-xl border border-line p-3"
      >
        <label className="text-[11px] text-muted" htmlFor="obs">New operational observation</label>
        <textarea
          id="obs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Describe what you observed (no diagnoses)…"
          className="mt-1 w-full resize-none rounded-lg border border-line-strong bg-ink/[0.05] px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent/60"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[10px] text-faint">Logged under your user at the current time. Kept separate from veterinary records.</p>
          <Button size="sm" variant="primary" type="submit" disabled={!text.trim()}>Log</Button>
        </div>
      </form>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-2">Keeper observations</p>
          {mine.length === 0 ? (
            <p className="text-xs text-muted">No data.</p>
          ) : (
            <ul className="scroll-thin max-h-[260px] space-y-3 overflow-y-auto pr-1">
              {mine.map((n) => (
                <li key={n.id} className={cx("border-l-2 pl-3", n.simulated ? "border-line-strong" : "border-accent")}>
                  <p className="text-sm">{n.text}</p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {n.by} · {fmtDateTime(n.at, asOf)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-5">
          <div>
            <p className="eyebrow mb-2">Next review</p>
            {nextReview ? (
              <>
                <p className="text-xs">{fmtDateTime(nextReview.nextReviewAt!, asOf)}</p>
                <p className="text-[11px] text-faint">{nextReview.title}</p>
              </>
            ) : (
              <p className="text-xs text-muted">Not scheduled.</p>
            )}
          </div>
          <div>
            <p className="eyebrow mb-2">Related incidents</p>
            {incidents.length === 0 ? (
              <p className="text-xs text-muted">No data.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {incidents.map((i) => (
                  <li key={i.id}>
                    <p>{i.title}</p>
                    <p className="text-[11px] text-faint">{fmtDateTime(i.openedAt, asOf)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-3 rounded-xl border border-dashed border-line-strong p-3">
        <Stethoscope size={16} className="mt-0.5 shrink-0 text-faint" />
        <div className="text-xs">
          <p className="font-medium">Veterinary records</p>
          <p className="mt-0.5 text-muted">No data yet. They are kept separate from operational observations and will come from the veterinary system once integrated.</p>
          <p className="mt-1 text-[11px] text-faint">The platform does not generate diagnoses or clinical recommendations.</p>
        </div>
      </div>
    </Card>
  );
}
