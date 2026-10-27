"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bird,
  Droplets,
  ExternalLink,
  Map as MapIcon,
  MapPinned,
  Mountain,
  Timer,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { PENGUIN_ZONES, ZONE_BY_ID, ZONE_KIND_LABEL } from "@/domain/habitat";
import { SPECIES, SPECIES_BY_ID } from "@/domain/species";
import { RANGE_LABEL, type RangePreset } from "@/logic/filters";
import { computeActivity, type Breakdown } from "@/logic/metrics";
import type { Snapshot } from "@/logic/status";
import { QUALITY_LABEL, SOURCE_SHORT } from "@/logic/labels";
import { fmtAgo, fmtTime } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { Donut, SERIES, StackedColumns } from "@/components/charts/Charts";
import { HabitatMap, type MapMarker } from "@/components/map/HabitatMap";
import { PenguinIllustration } from "@/components/penguin/PenguinIllustration";
import { StatusPill } from "@/components/penguin/StatusPill";
import { Segmented, cx } from "@/components/ui/primitives";

const RANGES: RangePreset[] = ["today", "24h", "7d", "14d"];
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function OverviewView() {
  const { dataset, visible, snapshots, teamOf, range, filters, setFilters, now } = useDemo();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);

  // Penguins that pass the global filters.
  const shown = useMemo(() => visible.map((p) => snapshots.get(p.id)!), [visible, snapshots]);
  const ids = useMemo(() => shown.map((s) => s.penguin.id), [shown]);
  const idSet = useMemo(() => new Set(ids), [ids]);
  const zoneSet = useMemo(() => new Set(filters.zones), [filters.zones]);
  const teamName = (id: string) => dataset.teams.find((t) => t.id === id)?.name ?? "—";

  const total = shown.length;
  // "No movement" counts as on land.
  const inWater = shown.filter((s) => s.status === "water").length;
  const onLand = shown.filter((s) => s.status === "land" || s.status === "resting").length;
  const teamsActive = new Set(ids.map(teamOf)).size;

  // Activity for the period and for the previous period of the same length.
  const agg = useMemo(() => computeActivity(dataset, ids, range.from, range.to, zoneSet), [dataset, ids, range, zoneSet]);
  const prevAgg = useMemo(() => {
    const len = range.to - range.from;
    if (len <= 0 || range.from - len < dataset.windowStart) return null;
    return computeActivity(dataset, ids, range.from - len, range.from, zoneSet);
  }, [dataset, ids, range, zoneSet]);

  const zoneCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of shown) if (s.reading) m.set(s.reading.zoneId, (m.get(s.reading.zoneId) ?? 0) + 1);
    return m;
  }, [shown]);
  const located = [...zoneCounts.values()].reduce((a, b) => a + b, 0);

  const markers: MapMarker[] = shown
    .filter((s) => s.reading)
    .map((s) => ({
      id: s.penguin.id,
      x: s.reading!.x,
      y: s.reading!.y,
      color: SPECIES_BY_ID[s.penguin.speciesId].color,
      status: s.status,
      medium: s.reading!.medium,
      accuracyM: s.reading!.accuracyM,
    }));

  const selected = selectedId && idSet.has(selectedId) ? snapshots.get(selectedId)! : null;
  const zone = zoneId ? ZONE_BY_ID[zoneId] : null;
  const fullMapHref = selected ? `/map?penguin=${selected.penguin.id}` : zone ? `/map?zone=${zone.id}` : "/map";
  const kpis: { label: string; value: number; share?: number; icon: LucideIcon; color: string; href: string }[] = [
    { label: "Registered penguins", value: total, icon: Bird, color: "var(--ice)", href: "/penguins" },
    { label: "In water", value: inWater, share: pct(inWater, total), icon: Droplets, color: SERIES.water, href: "/map" },
    { label: "On land", value: onLand, share: pct(onLand, total), icon: Mountain, color: SERIES.land, href: "/map" },
    { label: "Active teams", value: teamsActive, icon: Users, color: "#a78bfa", href: "/teams" },
  ];

  return (
    <div className="space-y-3 px-4 pb-6 pt-4 lg:px-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Penguins</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Penguin overview</h1>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full bg-ok" />
              Simulated data · latest readings at {fmtTime(now)}
            </span>
          </div>
        </div>
        <Segmented<RangePreset>
          value={RANGES.includes(filters.range) ? filters.range : "24h"}
          onChange={(v) => setFilters({ range: v })}
          options={RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }))}
        />
      </div>

      {/* KPIs */}
      {/* Four KPIs: two per row on small screens, a single row on large ones. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="panel group flex items-center gap-3 px-4 py-3 transition hover:border-line-strong">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${k.color} 14%, transparent)`, color: k.color }}>
              <k.icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="num text-[24px] font-semibold leading-none">{k.value}</p>
              <p className="mt-1 flex items-baseline justify-between gap-2 text-[11px] text-muted">
                <span className="truncate">{k.label}</span>
                {k.share !== undefined && <span className="num text-faint">{k.share}%</span>}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Map + side breakdowns */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel flex min-w-0 flex-col overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <MapIcon size={17} className="text-accent" />
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">Habitat map</h3>
                <p className="text-[11px] text-muted">Last recorded location of each penguin · {located} with a position · click one for reading time and source</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={fullMapHref} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-semibold text-white hover:bg-[#0b8178]">
                <MapPinned size={14} /> Open full map
              </Link>
            </div>
          </header>

          <div className="relative h-[clamp(340px,calc(100vh-290px),700px)] w-full border-y border-line bg-[#ece2cd]">
            <HabitatMap
              markers={markers}
              selectedId={selected?.penguin.id ?? null}
              onSelect={(id) => {
                setSelectedId(id);
                if (id) setZoneId(null);
              }}
              selectedZones={zone ? [zone.id] : []}
              penguinMarkers={filters.species.length > 0 || filters.teams.length > 0 || filters.zones.length > 0}
              onZoneClick={(z) => {
                if (ZONE_BY_ID[z].kind === "restricted") return;
                setZoneId(z === zoneId ? null : z);
                setSelectedId(null);
              }}
              zoneCounts={zoneCounts}
              labelScale={1.35}
              live
              layers={{ zones: true, labels: true, landmarks: false, markers: true, restricted: true, trail: false }}
            />
            {selected && <PenguinCard s={selected} team={teamName(teamOf(selected.penguin.id))} now={now} onClose={() => setSelectedId(null)} />}
            {!selected && zone && (
              <MapCard onClose={() => setZoneId(null)}>
                <p className="eyebrow">{ZONE_KIND_LABEL[zone.kind]}{zone.restricted ? " · restricted" : ""}</p>
                <p className="mt-0.5 text-sm font-semibold">{zone.name}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {zoneCounts.get(zone.id) ?? 0} {(zoneCounts.get(zone.id) ?? 0) === 1 ? "penguin" : "penguins"} last recorded here · {dataset.teams.filter((t) => t.zoneIds.includes(zone.id)).map((t) => t.name).join(", ") || "no team assigned"}
                </p>
                <div className="mt-2.5 flex gap-1.5">
                  <Link href={`/map?zone=${zone.id}`} className="inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-semibold text-white">
                    Open in Habitat Map <ArrowUpRight size={12} />
                  </Link>
                  <button
                    onClick={() => setFilters({ zones: filters.zones.includes(zone.id) ? filters.zones.filter((x) => x !== zone.id) : [...filters.zones, zone.id] })}
                    className="inline-flex h-7 items-center rounded-lg border border-line-strong px-2.5 text-[11px] text-ink hover:bg-ink/5"
                  >
                    {filters.zones.includes(zone.id) ? "Remove filter" : "Filter by zone"}
                  </button>
                </div>
              </MapCard>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-[11px] text-muted">
            {SPECIES.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.nameEn.replace(" Penguin", "")}
              </span>
            ))}
            <span className="mx-1 hidden h-3 w-px bg-line-strong sm:block" />
            <LegendMark ring color={SERIES.water} label="In water" />
            <LegendMark color={SERIES.land} label="On land" />
            <span className="ml-auto text-faint">Click a penguin or zone for details</span>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 xl:grid-rows-[auto_1fr]">
          <Panel title="Species breakdown" icon={Bird} href="/species" linkLabel="View all">
            <ul className="space-y-1">
              {SPECIES.map((s) => {
                const n = shown.filter((x) => x.penguin.speciesId === s.id).length;
                const on = filters.species.includes(s.id);
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setFilters({ species: on ? filters.species.filter((x) => x !== s.id) : [...filters.species, s.id] })}
                      title={on ? "Remove filter" : "Filter by species"}
                      className={cx("flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition hover:bg-ink/[0.03]", on && "bg-ink/[0.05]")}
                    >
                      <PenguinIllustration speciesId={s.id} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate text-[13px]">{s.nameEn}</span>
                          <span className="num w-7 text-right text-sm font-semibold">{n}</span>
                          <span className="num w-9 text-right text-[11px] text-faint">{pct(n, total)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct(n, total)}%`, background: s.color }} />
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Care teams" icon={Users} href="/teams" linkLabel="View all">
            <ul className="space-y-2.5">
              {dataset.teams.map((t) => {
                const n = ids.filter((id) => teamOf(id) === t.id).length;
                return (
                  <li key={t.id} className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${t.color}22`, color: t.color }}>
                      <Users size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px]">{t.name}</span>
                        <span className="num text-[11px] text-faint">{pct(n, total)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct(n, total)}%`, background: t.color }} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        <span className="num">{n}</span> {n === 1 ? "penguin" : "penguins"} · <span className="num">{t.zoneIds.length}</span> {t.zoneIds.length === 1 ? "zone" : "zones"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ActivityPanel agg={agg.totals} prev={prevAgg?.totals ?? null} daily={agg} rangeLabel={range.label} zonesFiltered={filters.zones.length > 0} />

        <Panel title="Penguins by habitat zone" icon={MapPinned} href="/map" linkLabel="View on map">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px_40px] gap-x-3 pb-1.5 text-[10px] uppercase tracking-wider text-faint">
            <span>Zone</span>
            <span />
            <span className="text-right">Birds</span>
            <span className="text-right">%</span>
          </div>
          {/* On wide screens the list takes the height of the activity panel beside it and scrolls inside. */}
          <div className="lg:relative lg:min-h-[180px] lg:flex-1">
            <ul className="scroll-thin max-h-[236px] overflow-y-auto pr-1 lg:absolute lg:inset-0 lg:max-h-none">
              {PENGUIN_ZONES.map((z) => ({ z, n: zoneCounts.get(z.id) ?? 0 }))
                .sort((a, b) => b.n - a.n)
                .map(({ z, n }) => (
                  <li key={z.id}>
                    <Link
                      href={`/map?zone=${z.id}`}
                      title="Open this zone in Habitat Map"
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px_40px] items-center gap-x-3 rounded-md py-1 text-[12px] hover:bg-ink/[0.03]"
                    >
                      <span className="truncate">{z.name}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                        <span className="block h-full rounded-full" style={{ width: `${pct(n, Math.max(1, ...zoneCounts.values()))}%`, background: zoneColor(z.id) }} />
                      </span>
                      <span className="num text-right">{n}</span>
                      <span className="num text-right text-faint">{pct(n, located)}%</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function zoneColor(id: string) {
  const z = ZONE_BY_ID[id];
  return z.medium === "water" ? SERIES.water : z.kind === "feeding" ? "var(--accent)" : z.kind === "care" ? "#a78bfa" : SERIES.land;
}

function Panel({ title, icon: Icon, href, linkLabel, className, children }: {
  title: string;
  icon: LucideIcon;
  href: string;
  linkLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("panel flex min-w-0 flex-col p-4", className)}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
          <Icon size={16} className="text-accent" />
          {title}
        </h3>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[11px] text-accent hover:underline">
          {linkLabel} <ArrowRight size={12} />
        </Link>
      </header>
      {children}
    </section>
  );
}

function LegendMark({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={ring ? { background: "#9fb3c8", boxShadow: `0 0 0 2px var(--panel-solid), 0 0 0 3px ${color}` } : { background: color }}
      />
      {label}
    </span>
  );
}

function MapCard({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="panel absolute left-3 top-3 z-10 w-[min(320px,calc(100%-24px))] p-3 shadow-2xl">
      <button onClick={onClose} aria-label="Close" className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink">
        <X size={13} />
      </button>
      {children}
    </div>
  );
}

function PenguinCard({ s, team, now, onClose }: { s: Snapshot; team: string; now: number; onClose: () => void }) {
  const sp = SPECIES_BY_ID[s.penguin.speciesId];
  return (
    <MapCard onClose={onClose}>
      <div className="flex gap-3">
        <PenguinIllustration speciesId={s.penguin.speciesId} size={56} />
        <div className="min-w-0 flex-1 pr-5">
          <p className="font-mono text-sm font-semibold">{s.penguin.id}</p>
          <p className="truncate text-[11px] text-muted">{sp.nameEn}</p>
          <div className="mt-1.5">
            <StatusPill status={s.status} compact />
          </div>
        </div>
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-faint">Zone</dt>
        <dd className="truncate text-right">{s.reading ? ZONE_BY_ID[s.reading.zoneId].name : "—"}</dd>
        <dt className="text-faint">Last reading</dt>
        <dd className="text-right">{s.reading ? `${fmtTime(s.reading.timestamp)} · ${fmtAgo(s.reading.timestamp, now)}` : "—"}</dd>
        <dt className="text-faint">Source</dt>
        <dd className="truncate text-right" title={s.reading ? `${QUALITY_LABEL[s.reading.quality]} quality · simulated` : undefined}>
          {s.reading ? `${SOURCE_SHORT[s.reading.source]} · ±${s.reading.accuracyM} m` : "—"}
        </dd>
        <dt className="text-faint">Team</dt>
        <dd className="truncate text-right">{team}</dd>
      </dl>
      <div className="mt-2.5 flex gap-1.5">
        <Link href={`/penguins/${s.penguin.id}`} className="inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-semibold text-white">
          View profile <ArrowUpRight size={12} />
        </Link>
        <Link href={`/map?penguin=${s.penguin.id}`} className="inline-flex h-7 items-center gap-1 rounded-lg border border-line-strong px-2.5 text-[11px] text-ink hover:bg-ink/5">
          <ExternalLink size={11} /> Path on map
        </Link>
      </div>
    </MapCard>
  );
}

function ActivityPanel({ agg, prev, daily, rangeLabel, zonesFiltered }: {
  agg: Breakdown;
  prev: Breakdown | null;
  daily: ReturnType<typeof computeActivity>;
  rangeLabel: string;
  zonesFiltered: boolean;
}) {
  // Split of recorded time for the period; "no movement" is part of time on land.
  const share = (b: Breakdown, k: "water" | "land" | "stationary") => {
    const tot = b.water + b.land;
    return tot > 0 ? (b[k] / tot) * 100 : 0;
  };
  const rings = [
    { k: "water" as const, label: "In water", color: SERIES.water },
    { k: "land" as const, label: "On land", color: SERIES.land },
    { k: "stationary" as const, label: "No movement", color: SERIES.stationary },
  ];
  const multiDay = daily.daily.length > 2;
  return (
    <Panel title="Water & land activity" icon={Timer} href="/analytics" linkLabel="Analytics">
      <p className="-mt-1.5 mb-2 text-[11px] text-muted">{rangeLabel} · share of recorded time per penguin</p>
      <div className="grid grid-cols-3 gap-2">
        {rings.map((r) => {
          const v = share(agg, r.k);
          const d = prev ? v - share(prev, r.k) : null;
          return (
            <div key={r.k} className="flex flex-col items-center text-center">
              <Donut
                size={84}
                thickness={9}
                parts={[
                  { value: v, color: r.color, label: r.label },
                  { value: Math.max(0, 100 - v), color: "rgba(11,36,64,0.04)", label: "Rest" },
                ]}
                center={<span className="num text-[17px] font-semibold">{Math.round(v)}%</span>}
              />
              <p className="mt-1.5 text-[12px]">{r.label}</p>
              <p className="num text-[11px] text-faint">
                {d === null ? "no prior period" : `${d >= 0.5 ? "+" : d <= -0.5 ? "−" : "±"}${Math.abs(Math.round(d))} pp vs. prior`}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <StackedColumns
          height={54}
          labelEvery={multiDay ? Math.ceil(daily.daily.length / 7) : 6}
          format={(v) => `${Math.round(v * 100)}%`}
          series={[
            { key: "water", color: SERIES.water, label: "Water" },
            { key: "land", color: SERIES.land, label: "Land" },
          ]}
          data={(multiDay ? daily.daily : daily.hourly).map((b: Breakdown & { day?: number }, i) => {
            const tot = b.water + b.land || 1;
            const label = multiDay && b.day !== undefined ? new Date(b.day).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : `${String(i).padStart(2, "0")}h`;
            return { label, values: { water: b.water / tot, land: b.land / tot } };
          })}
        />
      </div>
      {zonesFiltered && <p className="mt-1 text-[10px] text-faint">With a zone filter, only readings inside those zones count.</p>}
    </Panel>
  );
}
