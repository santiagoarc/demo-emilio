"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Bird, ExternalLink, Feather, Map as MapIcon, MapPinned, Radio, Timer, TreePine, Users, X, type LucideIcon } from "lucide-react";
import { FIX_STATUS, MONITOR_ZONES, MONITOR_ZONE_BY_ID } from "@/domain/aviaryTracking";
import { MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { MONITOR_TEAMS, MONITOR_TEAM_BY_ID } from "@/data/aviaryTeams";
import { activityBreakdown, flightStats } from "@/logic/aviaryActivity";
import { fmtHeight, type Fix } from "@/logic/aviaryTracking";
import { DAY, fmtAgo, fmtTime, startOfDay } from "@/logic/time";
import { useTeamAssignments } from "@/state/useTeams";
import { Donut, StackedColumns } from "@/components/charts/Charts";
import { Segmented, cx } from "@/components/ui/primitives";
import { DEFAULT_SCENE_LAYERS, type ScenePoint } from "./monitor/AviaryScene";
import { AviaryImageMap, type ZoneStat } from "./monitor/AviaryImageMap";
import { SpeciesAvatar } from "./SpeciesAvatar";
import { lastPlace } from "./AviaryPanels";
import { useAviarySnapshot } from "./common";

/**
 * Aviary overview: the penguin overview for birds. Indicators, the aviary picture with its
 * areas, species and care-team breakdowns, flight activity and birds by zone.
 */

type PeriodId = "24h" | "7d";
const PERIOD: Record<PeriodId, { ms: number; label: string }> = { "24h": { ms: DAY, label: "Last 24 h" }, "7d": { ms: 7 * DAY, label: "Last 7 days" } };
const C = { flying: "#2563eb", walking: "#c7850c", perched: "#16a34a", ground: "#9fb4c7" };
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function AviaryOverviewView() {
  const { registry, ds, asOf, fixes } = useAviarySnapshot();
  const { teamOf } = useTeamAssignments(registry);
  const [period, setPeriod] = useState<PeriodId>("24h");
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [birdId, setBirdId] = useState<string | null>(null);

  const all = useMemo(() => [...fixes.values()], [fixes]);
  const total = all.length;
  const detected = all.filter((f) => f.status === "detected" || f.status === "moving").length;
  const inTrees = all.filter((f) => f.det?.treeId && f.levelId && f.levelId !== "ground").length;
  const onGround = all.filter((f) => f.levelId === "ground").length;

  const zoneStats: ZoneStat[] = useMemo(
    () =>
      MONITOR_ZONES.map((z) => {
        const list = all.filter((f) => f.det?.zoneId === z.id);
        const sp = new Map<string, number>();
        for (const f of list) sp.set(f.bird.speciesId, (sp.get(f.bird.speciesId) ?? 0) + 1);
        return {
          zoneId: z.id,
          count: list.length,
          detected: list.filter((f) => f.status === "detected" || f.status === "moving").length,
          noSignal: list.filter((f) => f.status === "no-signal").length,
          species: [...sp.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ name: MONITOR_SPECIES_BY_ID[id].common, color: MONITOR_SPECIES_BY_ID[id].color, n })),
        };
      }),
    [all],
  );
  const located = zoneStats.reduce((a, z) => a + z.count, 0);
  const points: ScenePoint[] = useMemo(
    () =>
      all
        .filter((f) => f.det?.pos)
        .map((f) => {
          const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
          // With an area picked, only its birds are drawn (the others are dimmed out).
          return { id: f.bird.id, pos: f.det!.pos!, color: sp.color, dim: !!zoneId && f.det!.zoneId !== zoneId, label: `${f.bird.id} · ${sp.common} · ${fmtHeight(f.det!.pos!.y)}` };
        }),
    [all, zoneId],
  );

  // Recorded time of every bird in the period, and in the previous period of the same length.
  const from = Math.max(ds.windowStart, asOf - PERIOD[period].ms);
  const act = useMemo(() => {
    const sum = (a: number, b: number) => {
      const t = { flying: 0, walking: 0, perched: 0, ground: 0 };
      for (const bird of registry.birds) {
        if (bird.device.status === "intermittent") continue;
        const s = flightStats(bird, ds.stays.get(bird.id) ?? [], a, b);
        t.flying += s.flyingMs;
        t.walking += s.walkingMs;
        t.perched += s.perchedMs;
        t.ground += s.groundMs;
      }
      return t;
    };
    const len = asOf - from;
    return { cur: sum(from, asOf), prev: from - len >= ds.windowStart ? sum(from - len, from) : null };
  }, [registry, ds, from, asOf]);
  const series = useMemo(() => {
    const birds = registry.birds.filter((b) => b.device.status !== "intermittent");
    if (period === "24h") {
      const h = Array.from({ length: 24 }, () => ({ flying: 0, walking: 0 }));
      for (const b of birds) activityBreakdown(b, ds.stays.get(b.id) ?? [], from, asOf).hourly.forEach((x, i) => ((h[i].flying += x.flying), (h[i].walking += x.walking)));
      return h.map((x, i) => ({ label: `${String(i).padStart(2, "0")}h`, values: x }));
    }
    const out = [];
    for (let d = startOfDay(from); d < asOf; d += DAY) {
      const v = { flying: 0, walking: 0 };
      for (const b of birds) {
        const s = flightStats(b, ds.stays.get(b.id) ?? [], Math.max(d, from), Math.min(d + DAY, asOf));
        v.flying += s.flyingMs;
        v.walking += s.walkingMs;
      }
      out.push({ label: new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short" }), values: v });
    }
    return out;
  }, [registry, ds, from, asOf, period]);

  const selected = birdId ? fixes.get(birdId) ?? null : null;
  const zone = zoneId ? MONITOR_ZONE_BY_ID[zoneId] : null;
  const zStat = zoneId ? zoneStats.find((z) => z.zoneId === zoneId) : null;
  const fullMapHref = selected ? `/aviary/map?bird=${selected.bird.id}` : "/aviary/map";
  const kpis: { label: string; value: number; share?: number; icon: LucideIcon; color: string; href: string }[] = [
    { label: "Registered birds", value: total, icon: Bird, color: "var(--ice)", href: "/aviary/birds" },
    { label: "In trees", value: inTrees, share: pct(inTrees, total), icon: TreePine, color: C.perched, href: "/aviary/map" },
    { label: "On the ground", value: onGround, share: pct(onGround, total), icon: Feather, color: "#c7850c", href: "/aviary/map" },
    { label: "Active care teams", value: MONITOR_TEAMS.length, icon: Users, color: "#a78bfa", href: "/aviary/teams" },
  ];
  const maxTeam = Math.max(1, ...MONITOR_TEAMS.map((t) => all.filter((f) => teamOf(f.bird) === t.id).length));
  const speciesRows = useMemo(
    () =>
      registry.species
        .map((s) => ({ s, n: all.filter((f) => f.bird.speciesId === s.id).length }))
        .sort((a, b) => b.n - a.n),
    [registry, all],
  );

  return (
    <div className="space-y-3 px-4 pb-6 pt-4 lg:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Aviary</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Aviary overview</h1>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full bg-ok" />
              Latest detections at {fmtTime(asOf)} · {detected} of {total} detected
            </span>
          </div>
        </div>
        <Segmented value={period} onChange={setPeriod} options={[{ value: "24h", label: "24 h" }, { value: "7d", label: "7 days" }]} />
      </div>

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

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel flex min-w-0 flex-col overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <MapIcon size={17} className="text-accent" />
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">Aviary map</h3>
                <p className="text-[11px] text-muted">Last detected location of each bird · {located} located · click an area to see its birds</p>
              </div>
            </div>
            <Link href={fullMapHref} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-semibold text-white hover:bg-[#0b8178]">
              <MapPinned size={14} /> Open full map
            </Link>
          </header>

          <div className="relative h-[clamp(340px,calc(100vh-290px),700px)] w-full border-y border-line">
            <AviaryImageMap
              aggregate
              zoneStats={zoneStats}
              trees={registry.trees}
              points={points}
              selectedBirdId={birdId}
              selectedTreeId={null}
              highlightZoneId={zoneId}
              precision={null}
              trail={null}
              focus={null}
              layers={DEFAULT_SCENE_LAYERS}
              cluster
              onSelectBird={(id) => setBirdId(id)}
              onSelectTree={() => {}}
              onSelectZone={(z) => (setZoneId((cur) => (cur === z ? null : z)), setBirdId(null))}
            />
            {selected && <BirdCard f={selected} team={MONITOR_TEAM_BY_ID[teamOf(selected.bird)].name} asOf={asOf} onClose={() => setBirdId(null)} />}
            {!selected && zone && zStat && (
              <MapCard onClose={() => setZoneId(null)}>
                <p className="eyebrow">{zone.code}</p>
                <p className="mt-0.5 text-sm font-semibold">{zone.name}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {zStat.count} birds last detected here · {zStat.species.length} species · {zStat.noSignal} without recent signal
                </p>
                <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
                  {zStat.species.map((sp) => (
                    <span key={sp.name} style={{ width: `${(sp.n / Math.max(1, zStat.count)) * 100}%`, background: sp.color }} />
                  ))}
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <Link href="/aviary/map" className="inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-semibold text-white">
                    Open in the map <ArrowUpRight size={12} />
                  </Link>
                </div>
              </MapCard>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-[11px] text-muted">
            <span>Dot colour = species</span>
            <span className="mx-1 hidden h-3 w-px bg-line-strong sm:block" />
            {(["detected", "stale", "no-signal"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: FIX_STATUS[s].color }} />
                {FIX_STATUS[s].label}
              </span>
            ))}
            <span className="ml-auto text-faint">Click an area, then a bird, for details</span>
          </div>
        </section>

        {/* On wide screens the side column takes the map's height and its lists scroll inside. */}
        <div className="xl:relative">
          <div className="grid gap-3 sm:grid-cols-2 xl:absolute xl:inset-0 xl:grid-cols-1 xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
            <Panel title="Species breakdown" icon={Bird} href="/aviary/species" linkLabel="View all">
              <ul className="scroll-thin -mr-1 max-h-[300px] space-y-1 overflow-y-auto pr-1 xl:min-h-0 xl:max-h-none xl:flex-1">
                {speciesRows.map(({ s, n }) => (
                  <li key={s.id}>
                    <Link href={`/aviary/map?species=${s.id}`} title="Show on the map" className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition hover:bg-ink/[0.03]">
                      <SpeciesAvatar code={s.code} size={26} ring={s.color} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate text-[12.5px]">{s.common}</span>
                          <span className="num w-7 text-right text-sm font-semibold">{n}</span>
                          <span className="num w-9 text-right text-[11px] text-faint">{pct(n, total)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                          <div className="h-full rounded-full" style={{ width: `${pct(n, speciesRows[0]?.n ?? 1)}%`, background: s.color }} />
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Care teams" icon={Users} href="/aviary/teams" linkLabel="View all">
              <ul className="scroll-thin -mr-1 max-h-[300px] space-y-2.5 overflow-y-auto pr-1 xl:min-h-0 xl:max-h-none xl:flex-1">
                {MONITOR_TEAMS.map((t) => {
                  const n = all.filter((f) => teamOf(f.bird) === t.id).length;
                  const sp = new Set(all.filter((f) => teamOf(f.bird) === t.id).map((f) => f.bird.speciesId)).size;
                  return (
                    <li key={t.id}>
                      <Link href={`/aviary/teams/${t.id}`} className="flex items-center gap-2.5 rounded-lg hover:bg-ink/[0.03]">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${t.color}22`, color: t.color }}>
                          <Users size={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="min-w-0 flex-1 truncate text-[13px]">{t.name}</span>
                            <span className="num text-[11px] text-faint">{pct(n, total)}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                            <div className="h-full rounded-full" style={{ width: `${pct(n, maxTeam)}%`, background: t.color }} />
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted">
                            <span className="num">{n}</span> birds · <span className="num">{sp}</span> species
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ActivityPanel cur={act.cur} prev={act.prev} series={series} label={PERIOD[period].label} multiDay={period === "7d"} />

        <Panel title="Birds by aviary zone" icon={MapPinned} href="/aviary/map" linkLabel="View on map">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px_40px] gap-x-3 pb-1.5 text-[10px] uppercase tracking-wider text-faint">
            <span>Zone</span>
            <span />
            <span className="text-right">Birds</span>
            <span className="text-right">%</span>
          </div>
          <ul className="space-y-0.5">
            {[...zoneStats]
              .sort((a, b) => b.count - a.count)
              .map((z) => {
                const zz = MONITOR_ZONE_BY_ID[z.zoneId];
                const max = Math.max(1, ...zoneStats.map((x) => x.count));
                return (
                  <li key={z.zoneId}>
                    <button
                      onClick={() => (setZoneId(z.zoneId), setBirdId(null))}
                      title="Show this area on the map above"
                      className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px_40px] items-center gap-x-3 rounded-md py-1 text-left text-[12px] hover:bg-ink/[0.03]"
                    >
                      <span className="truncate">{zz.code} · {zz.name}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                        <span className="block h-full rounded-full" style={{ width: `${pct(z.count, max)}%`, background: zz.color }} />
                      </span>
                      <span className="num text-right">{z.count}</span>
                      <span className="num text-right text-faint">{pct(z.count, located)}%</span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, href, linkLabel, className, children }: { title: string; icon: LucideIcon; href: string; linkLabel: string; className?: string; children: ReactNode }) {
  return (
    <section className={cx("panel flex min-h-0 min-w-0 flex-col p-4", className)}>
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

function BirdCard({ f, team, asOf, onClose }: { f: Fix; team: string; asOf: number; onClose: () => void }) {
  const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
  return (
    <MapCard onClose={onClose}>
      <div className="flex gap-3">
        <SpeciesAvatar code={sp.code} size={52} ring={sp.color} />
        <div className="min-w-0 flex-1 pr-5">
          <p className="font-mono text-sm font-semibold">{f.bird.id}</p>
          <p className="truncate text-[11px] text-muted">{sp.common}</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: FIX_STATUS[f.status].color }} /> {FIX_STATUS[f.status].label}
          </p>
        </div>
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-faint">Location</dt>
        <dd className="truncate text-right">{lastPlace(f)}</dd>
        <dt className="text-faint">Last detection</dt>
        <dd className="text-right">{f.det ? `${fmtTime(f.det.at)} · ${fmtAgo(f.det.at, asOf)}` : "—"}</dd>
        <dt className="text-faint">Precision</dt>
        <dd className="truncate text-right">{f.det?.precisionM != null ? `± ${f.det.precisionM.toFixed(1)} m · ${Math.round(f.det.confidence * 100)}%` : "Zone level"}</dd>
        <dt className="text-faint">Team</dt>
        <dd className="truncate text-right">{team}</dd>
      </dl>
      <div className="mt-2.5 flex gap-1.5">
        <Link href={`/aviary/birds/${f.bird.id}`} className="inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-semibold text-white">
          View profile <ArrowUpRight size={12} />
        </Link>
        <Link href={`/aviary/map?bird=${f.bird.id}`} className="inline-flex h-7 items-center gap-1 rounded-lg border border-line-strong px-2.5 text-[11px] text-ink hover:bg-ink/5">
          <ExternalLink size={11} /> Path on map
        </Link>
      </div>
    </MapCard>
  );
}

type Totals = { flying: number; walking: number; perched: number; ground: number };

function ActivityPanel({ cur, prev, series, label, multiDay }: { cur: Totals; prev: Totals | null; series: { label: string; values: { flying: number; walking: number } }[]; label: string; multiDay: boolean }) {
  const share = (t: Totals, k: keyof Totals) => {
    const tot = t.flying + t.walking + t.perched + t.ground;
    return tot > 0 ? (t[k] / tot) * 100 : 0;
  };
  const rings = [
    { k: "flying" as const, label: "Flying", color: C.flying, digits: 1 },
    { k: "perched" as const, label: "Perched in trees", color: C.perched, digits: 0 },
    { k: "ground" as const, label: "On the ground", color: C.ground, digits: 0 },
  ];
  return (
    <Panel title="Flight & perch activity" icon={Timer} href="/aviary/health" linkLabel="Health follow-up">
      <p className="-mt-1.5 mb-2 flex items-center gap-1.5 text-[11px] text-muted">
        <Radio size={11} /> {label} · share of recorded time, all birds with positions
      </p>
      <div className="grid grid-cols-3 gap-2">
        {rings.map((r) => {
          const v = share(cur, r.k);
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
                center={<span className="num text-[16px] font-semibold">{v.toFixed(r.digits)}%</span>}
              />
              <p className="mt-1.5 text-[12px]">{r.label}</p>
              <p className="num text-[11px] text-faint">{d === null ? "no prior period" : `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(r.digits)} pp vs. prior`}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <p className="mb-1 text-[10px] text-faint">Minutes in the air, all birds · {multiDay ? "per day" : "per hour"}</p>
        <StackedColumns
          height={54}
          labelEvery={multiDay ? 1 : 6}
          format={(v) => `${Math.round(v / 60000)} min`}
          series={[
            { key: "flying", color: C.flying, label: "Flying" },
            { key: "walking", color: C.walking, label: "Walking" },
          ]}
          data={series}
        />
      </div>
    </Panel>
  );
}
