"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Droplets,
  HeartPulse,
  History,
  ListOrdered,
  MapPin,
  MapPinned,
  Mountain,
  NotebookPen,
  Radio,
  SearchX,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES_BY_ID } from "@/domain/species";
import type { LocationReading } from "@/domain/types";
import { QUALITY_LABEL, QUALITY_TONE, RECORD_STATUS_LABEL, SOURCE_LABEL, SOURCE_SHORT } from "@/logic/labels";
import { computeActivity } from "@/logic/metrics";
import { firstIndexAtOrAfter, lastIndexAtOrBefore } from "@/logic/status";
import { DAY, HOUR, MIN, fmtAgo, fmtDate, fmtDateTime, fmtHours, fmtWeekday, fromDateInput, startOfDay, toDateInput } from "@/logic/time";
import { PERMISSIONS, useDemo } from "@/state/DemoProvider";
import { Badge, Button, Card, EmptyState, cx } from "@/components/ui/primitives";
import { SERIES, SplitBar, StackedColumns } from "@/components/charts/Charts";
import { HabitatMap, type TrailPoint } from "@/components/map/HabitatMap";
import { PeriodPicker } from "@/components/filters/PeriodPicker";
import { PenguinIllustration } from "@/components/penguin/PenguinIllustration";
import { StatusPill } from "@/components/penguin/StatusPill";
import { MovementHistory } from "@/components/penguin/MovementHistory";
import { TeamReassign } from "@/components/penguin/TeamReassign";
import { PenguinHealth } from "@/features/health/HealthCards";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "health", label: "Health" },
  { id: "location", label: "Location" },
  { id: "activity", label: "Activity" },
  { id: "readings", label: "Readings" },
  { id: "team", label: "Team" },
  { id: "history", label: "History" },
  { id: "care", label: "Care" },
];

export function PenguinProfileView() {
  const { id } = useParams<{ id: string }>();
  const { penguinById } = useDemo();
  const p = penguinById.get(decodeURIComponent(id ?? ""));
  if (!p) {
    return (
      <div className="p-8">
        <Card>
          <EmptyState icon={SearchX} title={`Penguin ${id} not found`} action={<Link href="/penguins" className="text-sm text-accent hover:underline">Go to the registry</Link>}>
            The scenario may have been regenerated with a different number of penguins.
          </EmptyState>
        </Card>
      </div>
    );
  }
  return <Profile key={p.id} penguinId={p.id} />;
}

function Profile({ penguinId }: { penguinId: string }) {
  const { dataset, penguinById, snapshots, teamOf, range, now } = useDemo();
  const p = penguinById.get(penguinId)!;
  const sp = SPECIES_BY_ID[p.speciesId];
  const snap = snapshots.get(penguinId)!;
  const team = dataset.teams.find((t) => t.id === teamOf(penguinId));
  const { from, to } = range;

  const agg = useMemo(() => computeActivity(dataset, [penguinId], from, to), [dataset, penguinId, from, to]);
  const r = snap.reading;
  const t = agg.totals;
  const title = p.name ?? p.id;

  return (
    <div className="pb-10">
      {/* 1. Header */}
      <div className="px-6 pt-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted">
          <Link href="/species" className="hover:text-ink">Species</Link>
          <ChevronRight size={12} className="text-faint" />
          <Link href={`/species/${sp.id}`} className="hover:text-ink">{sp.nameEn}</Link>
          <ChevronRight size={12} className="text-faint" />
          <span className="text-ink">{title}</span>
        </nav>
      </div>

      <div id="overview" className="mx-6 mt-3 scroll-mt-20 lg:mx-8">
        <div className="panel relative overflow-hidden p-5">
          <div className="absolute inset-y-0 right-0 w-2/3 opacity-[0.07]" style={{ background: `radial-gradient(circle at 85% 30%, ${sp.color}, transparent 65%)` }} />
          <div className="relative flex flex-wrap items-start gap-5">
            <figure className="shrink-0">
              <PenguinIllustration speciesId={p.speciesId} size={116} />
              <figcaption className="mt-1 max-w-[116px] text-center text-[10px] leading-tight text-faint">Representative image of the species</figcaption>
            </figure>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Individual profile</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <h1 className="text-[30px] font-semibold leading-tight tracking-tight">{p.name ?? <span className="text-muted">No name on record</span>}</h1>
                <span className="font-mono text-lg text-muted">{p.id}</span>
              </div>
              <p className="mt-1 text-sm">
                {sp.nameEn} <span className="text-muted">·</span> <i className="text-muted">{sp.scientific}</i>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill status={snap.status} />
                <Badge tone={p.recordStatus === "active" ? "ok" : p.recordStatus === "recent" ? "info" : "warn"}>{RECORD_STATUS_LABEL[p.recordStatus]}</Badge>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/[0.05] px-2 py-0.5 text-[11px] text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: team?.color ?? "#56718a" }} /> {team?.name ?? "Unassigned"}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-md bg-ink/[0.05] px-2 py-0.5 text-[11px] text-muted"
                  title={r ? `Last reading: ${fmtDateTime(r.timestamp, now)} · ${SOURCE_LABEL[r.source]} · ${QUALITY_LABEL[r.quality]} quality (±${r.accuracyM} m)` : undefined}
                >
                  <MapPin size={11} />
                  {r ? `${ZONE_BY_ID[r.zoneId].name} · ${fmtDateTime(r.timestamp, now)} · ${QUALITY_LABEL[r.quality]} quality` : "No location recorded"}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap justify-end gap-2">
                <Link href={`/species/${sp.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm text-ink hover:border-accent/50">
                  <ArrowLeft size={14} /> Species list
                </Link>
                <Link href={`/map?penguin=${p.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white hover:bg-[#0b8178]">
                  <MapPinned size={15} /> View on map
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-faint">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={12} /> {PERMISSIONS.role}
                </span>
                {PERMISSIONS.reassignTeam && (
                  <a href="#team" className="rounded-md border border-line px-1.5 py-0.5 text-muted hover:text-ink">Reassign team</a>
                )}
                {PERMISSIONS.addObservation && (
                  <a href="#care" className="rounded-md border border-line px-1.5 py-0.5 text-muted hover:text-ink">Log observation</a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section navigation */}
      <div className="sticky top-0 z-20 mt-4 border-y border-line bg-bg/85 px-6 backdrop-blur lg:px-8">
        <div className="scroll-thin flex items-center gap-1 overflow-x-auto py-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-muted hover:bg-ink/5 hover:text-ink">
              {s.label}
            </a>
          ))}
          <span className="ml-auto pl-3">
            <PeriodPicker />
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-5 px-6 lg:px-8">
        {/* 2. Indicators */}
        {/* Four indicators: two per row on medium screens, a single row on large ones. */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Last location" value={r ? ZONE_BY_ID[r.zoneId].name : "No data"} sub={r ? `${QUALITY_LABEL[r.quality]} quality · ±${r.accuracyM} m` : undefined} small />
          <Kpi label="Time in water" value={t.readings ? fmtHours(t.water) : "No data"} sub={range.label} color={SERIES.water} />
          <Kpi label="Time on land" value={t.readings ? fmtHours(t.land) : "No data"} sub={range.label} color="#f5b84b" />
          <Kpi label="Last reading" value={r ? fmtDateTime(r.timestamp, now) : "No data"} sub={r ? `${fmtAgo(r.timestamp, now)} · ${SOURCE_SHORT[r.source]}` : undefined} small />
        </div>

        <Card title={<span id="health" className="scroll-mt-20">Health</span>} icon={HeartPulse}>
          <PenguinHealth penguinId={penguinId} />
        </Card>

        <LocationSection penguinId={penguinId} />
        <ActivitySection penguinId={penguinId} />
        <ReadingsSection penguinId={penguinId} />

        {/* The history takes the height of the team card; care goes full width below. */}
        <div className="grid gap-5 xl:grid-cols-12">
          <TeamSection penguinId={penguinId} className="xl:col-span-5" />
          <TimelineSection penguinId={penguinId} className="xl:col-span-7" />
        </div>

        <CareSection penguinId={penguinId} />
      </div>
    </div>
  );
}

/* ───────────── 3. Location ───────────── */

function LocationSection({ penguinId }: { penguinId: string }) {
  const { dataset, penguinById, snapshots, range, now } = useDemo();
  const p = penguinById.get(penguinId)!;
  const sp = SPECIES_BY_ID[p.speciesId];
  const snap = snapshots.get(penguinId)!;
  const r = snap.reading;

  const trail: TrailPoint[] = useMemo(() => {
    const list = dataset.readings.get(penguinId) ?? [];
    const out: TrailPoint[] = [];
    for (let i = lastIndexAtOrBefore(list, now); i >= 0 && list[i].timestamp > now - 24 * HOUR; i--) {
      const q = list[i];
      out.push({ x: q.x, y: q.y, t: q.timestamp, quality: q.quality, medium: q.medium, zoneId: q.zoneId });
    }
    return out.reverse();
  }, [dataset, penguinId, now]);

  const trailFocus = useMemo(() => {
    if (!trail.length) return null;
    const xs = trail.map((q) => q.x), ys = trail.map((q) => q.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = Math.min(1600, Math.max((maxX - minX) * 1.5, (maxY - minY) * 1.5 * 1.6, 560));
    return { key: 1, x: (minX + maxX) / 2, y: (minY + maxY) / 2, w };
  }, [trail]);

  return (
    <Card
      title={<span id="location" className="scroll-mt-20">Location and movement history</span>}
      icon={MapPinned}
      subtitle="Path over the last 24 h. Each dot is a recorded reading; the lines only join consecutive readings and are not a measured route."
      action={
        <Link href={`/map?penguin=${p.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line-strong px-2.5 text-xs text-ink hover:border-accent/50">
          <MapPinned size={13} /> View on Habitat Map
        </Link>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_280px_300px]">
        <div className="aspect-[16/10] overflow-hidden rounded-xl border border-line bg-ink/[0.05]">
          {r ? (
            <HabitatMap
              markers={[{ id: p.id, x: r.x, y: r.y, color: sp.color, status: snap.status, medium: r.medium, accuracyM: r.accuracyM }]}
              selectedId={p.id}
              trail={trail}
              focus={trailFocus}
              layers={{ zones: true, labels: true, landmarks: false, markers: true, restricted: true, trail: true }}
            />
          ) : (
            <EmptyState icon={MapPinned} title="No location recorded" />
          )}
        </div>
        <dl className="space-y-2.5 text-sm">
          <Row k="Last recorded zone" v={r ? ZONE_BY_ID[r.zoneId].name : "No data"} />
          <Row k="Date and time" v={r ? `${fmtDateTime(r.timestamp, now)} · ${fmtAgo(r.timestamp, now)}` : "No data"} />
          <Row k="Source" v={r ? SOURCE_LABEL[r.source] : "No data"} />
          <Row k="Quality / accuracy" v={r ? <><Badge tone={QUALITY_TONE[r.quality]}>{QUALITY_LABEL[r.quality]}</Badge> <span className="text-[11px] text-faint">±{r.accuracyM} m</span></> : "No data"} />
          <Row k="Current status" v={<StatusPill status={snap.status} compact />} />
          <Row k="Device" v={<span className="font-mono">{p.deviceId}</span>} />
        </dl>
        <div>
          <p className="mb-2 text-xs font-medium">Zone changes · {range.label.toLowerCase()}</p>
          <div className="scroll-thin max-h-[330px] overflow-y-auto pr-1">
            <MovementHistory penguinId={penguinId} from={range.from} to={range.to} limit={40} />
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ───────────── 4. Activity ───────────── */

function ActivitySection({ penguinId }: { penguinId: string }) {
  const { dataset, range } = useDemo();
  const { from, to } = range;
  const agg = useMemo(() => computeActivity(dataset, [penguinId], from, to), [dataset, penguinId, from, to]);
  const span = to - from;
  const prev = useMemo(
    () => (from - span >= dataset.windowStart ? computeActivity(dataset, [penguinId], from - span, from).totals : null),
    [dataset, penguinId, from, span],
  );
  const changes = useMemo(() => {
    const recs = (dataset.activity.get(penguinId) ?? []).filter((x) => x.start >= from && x.start < to);
    let n = 0;
    for (let i = 1; i < recs.length; i++) if (recs[i].medium !== recs[i - 1].medium) n++;
    return n;
  }, [dataset, penguinId, from, to]);
  const t = agg.totals;
  // The daily share always shows the last week, regardless of the selected period.
  const byDay = useMemo(
    () =>
      computeActivity(dataset, [penguinId], Math.max(dataset.windowStart, startOfDay(dataset.now) - 6 * DAY), dataset.now)
        .daily.filter((d) => d.water + d.land > 0)
        .map((d) => ({ day: d.day, share: d.water / (d.water + d.land) })),
    [dataset, penguinId],
  );

  return (
    <Card
      title={<span id="activity" className="scroll-mt-20">Activity</span>}
      icon={Activity}
      subtitle={`${range.label} · hours recorded by the readings.`}
      
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBlock label="In water · observed" value={t.readings ? fmtHours(t.water) : "No data"} sub="Device immersion sensor" color={SERIES.water} />
        <MetricBlock label="On land · observed" value={t.readings ? fmtHours(t.land) : "No data"} sub="Land readings, moving or not" color={SERIES.land} />
        <MetricBlock label="No movement · inferred" value={t.readings ? fmtHours(t.stationary) : "No data"} sub="Share of land time with repeated positions" color={SERIES.stationary} />
        <MetricBlock label="Water ↔ land changes" value={String(changes)} sub="Between consecutive stretches" color="#a78bfa" />
      </div>
      <SplitBar
        className="mt-4"
        parts={[
          { value: t.water, color: SERIES.water, label: "Water" },
          { value: t.land, color: SERIES.land, label: "Land" },
        ]}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-xs text-muted">Distribution by hour of day · recorded hours</p>
          <StackedColumns
            height={140}
            labelEvery={6}
            format={fmtHours}
            series={[
              { key: "water", color: SERIES.water, label: "Water" },
              { key: "land", color: SERIES.land, label: "Land" },
            ]}
            data={agg.hourly.map((h, i) => ({ label: `${i}h`, tooltip: `${String(i).padStart(2, "0")}:00`, values: { water: h.water, land: h.land } }))}
          />
        </div>
        <div>
          <p className="mb-3 flex justify-between gap-2 text-xs text-muted">
            <span>% of time in water per day · last {byDay.length} {byDay.length === 1 ? "day" : "days"}</span>
            {byDay.length > 0 && (
              <span>
                average <b className="num font-semibold text-ink">{Math.round((byDay.reduce((a, d) => a + d.share, 0) / byDay.length) * 100)}%</b> in water
              </span>
            )}
          </p>
          <StackedColumns
            height={140}
            labelEvery={byDay.length > 8 ? 2 : 1}
            format={(v) => `${Math.round(v * 100)}%`}
            series={[
              { key: "water", color: SERIES.water, label: "Water" },
              { key: "land", color: SERIES.land, label: "Land" },
            ]}
            data={byDay.map((d) => ({ label: String(new Date(d.day).getDate()), tooltip: fmtWeekday(d.day), values: { water: d.share, land: 1 - d.share } }))}
          />
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-line p-4">
        <p className="mb-2 text-xs font-medium">Compared with the previous period of equal length</p>
        {prev ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Compare label="Water" cur={t.water} prev={prev.water} />
            <Compare label="Land" cur={t.land} prev={prev.land} />
            <Compare label="No movement" cur={t.stationary} prev={prev.stationary} />
          </div>
        ) : (
          <p className="text-xs text-muted">Not enough data: the scenario does not keep a complete previous period.</p>
        )}
        <p className="mt-2 text-[11px] text-faint">
          Observed: indicated by a reading. Inferred: “no movement” is deduced from repeated positions. A difference in activity does not by itself imply any health condition.
        </p>
      </div>
    </Card>
  );
}

/* ───────────── 5. Reading history ───────────── */

type ReadingFlag = "repeated" | "low";
const FLAG_LABEL: Record<ReadingFlag, string> = {
  repeated: "Repeated position",
  low: "Low accuracy",
};

function ReadingsSection({ penguinId }: { penguinId: string }) {
  const { dataset, penguinById, range, now } = useDemo();
  const p = penguinById.get(penguinId)!;
  const slot = dataset.slotMinutes * MIN;
  const [fromDay, setFromDay] = useState(toDateInput(range.from));
  const [toDay, setToDay] = useState(toDateInput(now));
  const [newest, setNewest] = useState(true);
  const [limit, setLimit] = useState(25);

  const rows = useMemo(() => {
    const list = dataset.readings.get(penguinId) ?? [];
    const a = Math.max(fromDateInput(fromDay), dataset.windowStart);
    const b = fromDateInput(toDay) + DAY;
    const out: { r: LocationReading; flags: ReadingFlag[] }[] = [];
    for (let i = firstIndexAtOrAfter(list, a); i < list.length && list[i].timestamp < b && list[i].timestamp <= now; i++) {
      const r = list[i];
      const prev = list[i - 1];
      const flags: ReadingFlag[] = [];
      if (prev && prev.x === r.x && prev.y === r.y && r.timestamp - prev.timestamp <= slot) flags.push("repeated");
      if (r.quality === "low") flags.push("low");
      out.push({ r, flags });
    }
    return newest ? out.reverse() : out;
  }, [dataset, penguinId, fromDay, toDay, newest, slot, now]);

  const minDay = toDateInput(dataset.windowStart);
  const maxDay = toDateInput(now);

  return (
    <Card
      title={<span id="readings" className="scroll-mt-20">Reading history</span>}
      icon={ListOrdered}
      subtitle={`${rows.length} ${rows.length === 1 ? "reading" : "readings"} in range. No coordinates are made up: each row is a recorded reading.`}
      action={
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-muted">
            From
            <input type="date" value={fromDay} min={minDay} max={toDay} onChange={(e) => (setFromDay(e.target.value || minDay), setLimit(25))} className="h-8 rounded-lg border border-line-strong bg-panel-solid px-2 text-xs text-ink [color-scheme:dark]" />
          </label>
          <label className="flex items-center gap-1.5 text-muted">
            To
            <input type="date" value={toDay} min={fromDay} max={maxDay} onChange={(e) => (setToDay(e.target.value || maxDay), setLimit(25))} className="h-8 rounded-lg border border-line-strong bg-panel-solid px-2 text-xs text-ink [color-scheme:dark]" />
          </label>
          <Button size="sm" variant="outline" onClick={() => setNewest((v) => !v)}>
            {newest ? "Newest first" : "Oldest first"}
          </Button>
        </div>
      }
    >
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-muted">
              <th className="py-2 pr-3 font-medium">Date and time</th>
              <th className="py-2 pr-3 font-medium">Zone · position</th>
              <th className="py-2 pr-3 font-medium">Location state</th>
              <th className="py-2 pr-3 font-medium">Source</th>
              <th className="py-2 pr-3 font-medium">Quality</th>
              <th className="py-2 pr-3 font-medium">Device</th>
              <th className="py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map(({ r, flags }) => (
              <tr key={r.timestamp} className="border-b border-line/60 last:border-0">
                <td className="whitespace-nowrap py-2 pr-3 text-xs">{fmtDateTime(r.timestamp, now)}</td>
                <td className="py-2 pr-3 text-xs">
                  {ZONE_BY_ID[r.zoneId].name}
                  <span className="ml-1.5 font-mono text-[10px] text-faint">
                    ({(r.x / dataset.habitat.unitsPerMeter).toFixed(1)}, {(r.y / dataset.habitat.unitsPerMeter).toFixed(1)}) m
                  </span>
                </td>
                <td className="py-2 pr-3 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    {r.medium === "water" ? <Droplets size={12} color={SERIES.water} /> : <Mountain size={12} color={SERIES.land} />}
                    {r.medium === "water" ? "In water" : "On land"}
                  </span>
                </td>
                <td className="py-2 pr-3 text-xs text-muted">{SOURCE_SHORT[r.source]}</td>
                <td className="py-2 pr-3 text-xs">
                  <Badge tone={QUALITY_TONE[r.quality]}>{QUALITY_LABEL[r.quality]}</Badge>
                  <span className="ml-1 text-[10px] text-faint">±{r.accuracyM} m</span>
                </td>
                <td className="py-2 pr-3 font-mono text-[11px] text-muted">{p.deviceId}</td>
                <td className="py-2 text-[11px]">
                  {flags.length === 0 ? (
                    <span className="text-faint">–</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {flags.map((f) => (
                        <Badge key={f} tone={f === "repeated" ? "neutral" : "warn"}>
                          {FLAG_LABEL[f]}
                        </Badge>
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-6 text-center text-xs text-muted">No readings in this range.</p>}
      </div>
      {rows.length > limit && (
        <button onClick={() => setLimit((l) => l + 50)} className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ChevronDown size={13} /> Show more ({rows.length - limit} remaining)
        </button>
      )}
    </Card>
  );
}

/* ───────────── 6. Team ───────────── */

function TeamSection({ penguinId, className }: { penguinId: string; className?: string }) {
  const { dataset, penguinById, teamOf, log, now } = useDemo();
  const p = penguinById.get(penguinId)!;
  const team = dataset.teams.find((t) => t.id === teamOf(penguinId));
  const initial = dataset.teams.find((t) => t.id === p.initialTeamId);
  const changes = log.filter((l) => l.penguinId === penguinId && l.kind === "assignment").sort((a, b) => b.at - a.at);

  return (
    <Card className={className} title={<span id="team" className="scroll-mt-20">Responsible team</span>} icon={Users}>
      {team ? (
        <div className="rounded-xl border border-line p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${team.color}22`, color: team.color }}>
              <Users size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{team.name}</p>
              <p className="text-xs text-muted">{team.focus}</p>
            </div>
            <Link href={`/teams?team=${team.id}`} className="text-xs text-accent hover:underline">View team</Link>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Team lead" v={team.lead} />
            <Row k="Members" v={team.members.length} />
            <Row k="Assigned on" v={changes[0] ? fmtDateTime(changes[0].at, now) : <span className="text-faint">No data (initial assignment)</span>} />
          </dl>
        </div>
      ) : (
        <p className="text-sm text-warn">Unassigned</p>
      )}

      {PERMISSIONS.reassignTeam ? (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] text-muted">Reassign (the change applies across the whole platform)</p>
          <TeamReassign key={penguinId} penguinId={penguinId} compact />
        </div>
      ) : (
        <p className="mt-4 text-[11px] text-faint">Your role cannot reassign penguins.</p>
      )}

      <div className="mt-5">
        <p className="eyebrow mb-2">Assignment history</p>
        <ol className="space-y-2 text-xs">
          {changes.map((c) => (
            <li key={c.id} className="flex gap-2">
              <ArrowRightLeft size={13} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <p>{c.text}</p>
                <p className="text-[11px] text-faint">{fmtDateTime(c.at, now)}</p>
              </div>
            </li>
          ))}
          <li className="flex gap-2">
            <Users size={13} className="mt-0.5 shrink-0 text-faint" />
            <div>
              <p>Initial assignment: {initial?.name ?? "No data"}</p>
              <p className="text-[11px] text-faint">Date not recorded in the scenario</p>
            </div>
          </li>
        </ol>
      </div>
    </Card>
  );
}

/* ───────────── 7. Care and observations ───────────── */

function CareSection({ penguinId, className }: { penguinId: string; className?: string }) {
  const { dataset, userNotes, log, lastReviewOf, config, addNote, now } = useDemo();
  const [text, setText] = useState("");
  const notes = [...userNotes, ...dataset.notes].filter((n) => n.penguinId === penguinId).sort((a, b) => b.at - a.at);
  const reviews = dataset.incidents
    .filter((i) => i.penguinId === penguinId && i.kind === "care")
    .map((i) => ({ id: i.id, at: i.at, text: i.text, by: "Care team" }))
    .sort((a, b) => b.at - a.at);
  const routineDue = lastReviewOf(penguinId) + config.rules.careReviewIntervalDays * DAY;
  const incidents = [
    ...dataset.incidents.filter((i) => i.penguinId === penguinId && i.kind !== "care"),
    ...log.filter((l) => l.penguinId === penguinId && l.kind !== "assignment"),
  ].sort((a, b) => b.at - a.at);

  return (
    <Card className={className} title={<span id="care" className="scroll-mt-20">Care and observations</span>} icon={NotebookPen}>
      {PERMISSIONS.addObservation ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            addNote(penguinId, text.trim());
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
            <p className="text-[10px] text-faint">Logged under your user at the current scenario time. Kept separate from veterinary records.</p>
            <Button size="sm" variant="primary" type="submit" disabled={!text.trim()}>Log</Button>
          </div>
        </form>
      ) : (
        <p className="mb-4 text-[11px] text-faint">Your role cannot log observations.</p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-2">Keeper observations</p>
          {notes.length === 0 ? (
            <p className="text-xs text-muted">No data.</p>
          ) : (
            <ul className="scroll-thin max-h-[260px] space-y-3 overflow-y-auto pr-1">
              {notes.map((n) => (
                <li key={n.id} className={cx("border-l-2 pl-3", n.simulated ? "border-line-strong" : "border-accent")}>
                  <p className="text-sm">{n.text}</p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {n.by} · {fmtDateTime(n.at, now)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-5">
          <div>
            <p className="eyebrow mb-2">Completed checks</p>
            {reviews.length === 0 ? (
              <p className="text-xs text-muted">No data.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {reviews.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <p>{r.text}</p>
                    <p className="text-[11px] text-faint">{r.by} · {fmtDateTime(r.at, now)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="eyebrow mb-2">Next routine check</p>
            <p className="text-xs">{fmtDateTime(routineDue, now)}</p>
            <p className="text-[11px] text-faint">Based on the {config.rules.careReviewIntervalDays}-day interval</p>
          </div>
          <div>
            <p className="eyebrow mb-2">Related incidents</p>
            {incidents.length === 0 ? (
              <p className="text-xs text-muted">No data.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {incidents.slice(0, 4).map((i) => (
                  <li key={i.id}>
                    <p>{i.text}</p>
                    <p className="text-[11px] text-faint">{fmtDateTime(i.at, now)}</p>
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

/* ───────────── 8. Change history ───────────── */

type EventKind = "zone" | "readings" | "team" | "review" | "note";
const EVENT_LABEL: Record<EventKind, string> = {
  zone: "Zone change",
  readings: "Readings",
  team: "Team",
  review: "Check",
  note: "Observation",
};
const EVENT_ICON: Record<EventKind, typeof MapPin> = { zone: MapPin, readings: Radio, team: ArrowRightLeft, review: ShieldCheck, note: NotebookPen };

function TimelineSection({ penguinId, className }: { penguinId: string; className?: string }) {
  const { dataset, log, userNotes, range, now } = useDemo();
  const [kinds, setKinds] = useState<EventKind[]>([]);
  const [limit, setLimit] = useState(30);

  const events = useMemo(() => {
    const out: { at: number; kind: EventKind; text: string }[] = [];
    const recs = (dataset.activity.get(penguinId) ?? []).filter((x) => x.start >= range.from && x.start < range.to);
    for (let i = 1; i < recs.length; i++) {
      const a = recs[i - 1], c = recs[i];
      if (a.zoneId === c.zoneId) continue;
      out.push({ at: c.start, kind: "zone", text: `${ZONE_BY_ID[a.zoneId].name} → ${ZONE_BY_ID[c.zoneId].name}` });
    }
    const list = dataset.readings.get(penguinId) ?? [];
    const perDay = new Map<number, number>();
    for (let i = firstIndexAtOrAfter(list, range.from); i < list.length && list[i].timestamp < range.to; i++) {
      const d = startOfDay(list[i].timestamp);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
    for (const [d, n] of perDay) out.push({ at: Math.min(d + DAY - MIN, now), kind: "readings", text: `${n} ${n === 1 ? "reading" : "readings"} received on ${fmtDate(d)}` });
    for (const l of log.filter((x) => x.penguinId === penguinId)) out.push({ at: l.at, kind: l.kind === "assignment" ? "team" : "review", text: l.text });
    for (const i of dataset.incidents.filter((x) => x.penguinId === penguinId && x.kind === "care")) out.push({ at: i.at, kind: "review", text: i.text });
    for (const n of userNotes.filter((x) => x.penguinId === penguinId)) out.push({ at: n.at, kind: "note", text: `${n.by}: ${n.text}` });
    return out.filter((e) => e.at <= now + HOUR).sort((a, b) => b.at - a.at);
  }, [dataset, penguinId, range, log, userNotes, now]);

  const shown = kinds.length ? events.filter((e) => kinds.includes(e.kind)) : events;

  return (
    <Card
      className={className}
      title={<span id="history" className="scroll-mt-20">Change history</span>}
      icon={History}
      subtitle={`Zones and readings: ${range.label.toLowerCase()}. Team, checks and observations: full record.`}
    >
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
        // On wide screens the list fills the height left by the team card beside it.
        <div className="xl:relative xl:min-h-[240px] xl:flex-1">
          <ol className="scroll-thin relative max-h-[440px] space-y-1 overflow-y-auto pr-1 xl:absolute xl:inset-0 xl:max-h-none before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-line-strong">
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
                      {EVENT_LABEL[e.kind]} · {fmtDateTime(e.at, now)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {shown.length > limit && (
        <button onClick={() => setLimit((l) => l + 40)} className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ChevronDown size={13} /> Show more ({shown.length - limit})
        </button>
      )}
    </Card>
  );
}

/* ───────────── helpers ───────────── */

function Kpi({ label, value, sub, color, small }: { label: string; value: string; sub?: string; color?: string; small?: boolean }) {
  return (
    <div className="panel px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        {color && <span className="h-2 w-2 rounded-sm" style={{ background: color }} />}
        {label}
      </p>
      <p className={cx("num mt-1 truncate font-semibold", small ? "text-base" : "text-xl")}>{value}</p>
      {sub && <p className="truncate text-[11px] text-faint">{sub}</p>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line pb-2 last:border-0">
      <dt className="shrink-0 text-[12px] text-muted">{k}</dt>
      <dd className="text-right text-[13px]">{v}</dd>
    </div>
  );
}

function MetricBlock({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <span className="h-2 w-2 rounded-sm" style={{ background: color }} /> {label}
      </p>
      <p className="num mt-1 text-2xl font-semibold">{value}</p>
      <p className="text-[11px] text-faint">{sub}</p>
    </div>
  );
}

function Compare({ label, cur, prev }: { label: string; cur: number; prev: number }) {
  const diff = cur - prev;
  return (
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p className="num font-semibold">{fmtHours(cur)}</p>
      <p className="num text-[11px] text-faint">
        before {fmtHours(prev)} · {diff >= 0 ? "+" : "−"}
        {fmtHours(Math.abs(diff))}
      </p>
    </div>
  );
}
