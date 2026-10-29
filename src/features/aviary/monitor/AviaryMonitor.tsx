"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, ArrowRight, CheckCircle2, Crosshair, Feather, Info, Layers, MapPin, Pause, Play, RotateCcw, Search, ShieldCheck, TreePine, X, XCircle } from "lucide-react";
import {
  AGE_LABEL,
  DEVICE_STATUS_LABEL,
  FIX_STATUS,
  FOOTPRINT,
  LEVELS,
  LOCATION_KIND,
  SIGNAL_LABEL,
  MONITOR_ZONES,
  MONITOR_ZONE_BY_ID,
  levelOf,
  type FixStatus,
  type LevelId,
  type LocationKind,
  type AviaryTree,
  type MonitorBird,
  type SpeciesGroup,
  type TrackingDataset,
  type TrackingSource,
  type Vec3,
} from "@/domain/aviaryTracking";
import { MONITOR_SPECIES, MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { HISTORY_DAYS, STRUCTURES } from "@/data/aviaryTrackingSimulate";
import { activityByHour, dataQuality, fmtHeight, historyRows, recentMoves, snapshot, treeHistory, treeOccupants, type Fix } from "@/logic/aviaryTracking";
import { runDemoChecks } from "@/logic/aviaryDemoChecks";
import { DAY, HOUR, MIN, fmtAgo, fmtDateTime, fmtTime } from "@/logic/time";
import { resetDemoData, useSimClock, useTracking, type TrackingState } from "@/state/useTracking";
import { Badge, Chip, Segmented, cx } from "@/components/ui/primitives";
import { BarList, Donut, LineChart, SplitBar } from "@/components/charts/Charts";
import { PageHeader } from "@/components/shell/AppShell";
import type { ScenePoint } from "./AviaryScene";
import { TreeSideView, type SideBird } from "./TreeSideView";

// WebGL only runs in the browser.
const AviaryScene = dynamic(() => import("./AviaryScene").then((m) => m.AviaryScene), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Loading 3D map…</div>,
});

type GroupFilter = "all" | SpeciesGroup;
const GROUPS: { id: GroupFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "toucan", label: "Toucans" },
  { id: "parrot", label: "Parrots" },
  { id: "turaco", label: "Turacos" },
  { id: "pigeon", label: "Pigeons" },
  { id: "galliform", label: "Pheasants" },
  { id: "wader", label: "Waders" },
  { id: "other", label: "Others" },
];
const SPEEDS = [
  { value: "1", label: "1×" },
  { value: "60", label: "60×" },
  { value: "300", label: "300×" },
] as const;

const KIND_COLOR: Record<LocationKind, string> = { confirmed: "#16A34A", "computed-3d": "#2563EB", zone: "#D97706", unknown: "#94A3B8" };
const STATUS_ORDER: FixStatus[] = ["detected", "moving", "stale", "no-signal"];
const TIME_PRESETS = [
  { label: "Live", min: 0 },
  { label: "−1 h", min: 60 },
  { label: "−6 h", min: 360 },
  { label: "−24 h", min: 1440 },
  { label: "−3 d", min: 4320 },
];
const WINDOWS = { "6h": 6 * HOUR, "24h": DAY, "7d": HISTORY_DAYS * DAY } as const;
type WindowId = keyof typeof WINDOWS;

const STATUS_TONE: Record<FixStatus, "ok" | "info" | "warn" | "danger"> = { detected: "ok", moving: "info", stale: "warn", "no-signal": "danger" };

export function AviaryMonitor() {
  const t = useTracking();
  // A reset creates a new registry: remount so every piece of state starts over.
  return <Monitor key={t.registry.createdAt} {...t} />;
}

function Monitor({ registry, origin, ds, src, treeById, birdById }: TrackingState) {
  const { clock, set: setClock, restart } = useSimClock(registry, ds.horizon);
  const now = clock.simTime;
  const params = useSearchParams();
  const paramBird = params.get("bird");

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [treeFilter, setTreeFilter] = useState<string | null>(null);
  const [level, setLevel] = useState<LevelId | "all">("all");
  const [statuses, setStatuses] = useState<Set<FixStatus>>(new Set(STATUS_ORDER));
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [colorBy, setColorBy] = useState<"status" | "species">("status");
  const [offsetMin, setOffsetMin] = useState(0);
  const [birdId, setBirdId] = useState<string | null>(null);
  const [treeId, setTreeId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ pos: Vec3; key: number } | null>(null);
  const [tab, setTab] = useState<"info" | "location" | "history">("location");
  const [win, setWin] = useState<WindowId>("6h");
  const [showTrail, setShowTrail] = useState(true);
  const [listLimit, setListLimit] = useState(60);

  const asOf = now - offsetMin * MIN;
  const fixes = useMemo(() => snapshot(ds, src, asOf), [ds, src, asOf]);

  const q = query.trim().toLowerCase();
  const matchesText = (b: MonitorBird) => {
    if (!q) return true;
    const sp = MONITOR_SPECIES_BY_ID[b.speciesId];
    return b.id.toLowerCase().includes(q) || sp.common.toLowerCase().includes(q) || sp.scientific.toLowerCase().includes(q) || (b.name?.toLowerCase().includes(q) ?? false);
  };

  /** Every filter except level: birds failing these are hidden. */
  const base = useMemo(
    () =>
      [...fixes.values()].filter((f) => {
        const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
        if (group !== "all" && sp.group !== group) return false;
        if (speciesId && f.bird.speciesId !== speciesId) return false;
        if (zoneId && f.det?.zoneId !== zoneId) return false;
        if (treeFilter && f.det?.treeId !== treeFilter) return false;
        if (!statuses.has(f.status)) return false;
        return matchesText(f.bird);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fixes, group, speciesId, zoneId, treeFilter, statuses, q],
  );
  const inLevel = (f: Fix) => level === "all" || f.levelId === level;
  const visible = useMemo(() => base.filter(inLevel), [base, level]); // eslint-disable-line react-hooks/exhaustive-deps

  const points: ScenePoint[] = useMemo(
    () =>
      base
        .filter((f) => f.det?.pos)
        .map((f) => {
          const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
          return {
            id: f.bird.id,
            pos: f.det!.pos!,
            color: colorBy === "species" ? sp.color : FIX_STATUS[f.status].color,
            dim: !inLevel(f),
            label: `${f.bird.id} · ${sp.common} · ${FIX_STATUS[f.status].label}`,
          };
        }),
    [base, colorBy, level], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const selFix = birdId ? fixes.get(birdId) ?? null : null;
  const selTree = treeId ? treeById.get(treeId) ?? null : null;

  const trail = useMemo(() => {
    if (!birdId || !showTrail || !selFix || selFix.bird.device.status === "intermittent") return null;
    return src.history(birdId, asOf - WINDOWS[win], asOf).filter((s) => s.start <= asOf).map((s) => s.pos);
  }, [birdId, showTrail, selFix, src, asOf, win]);

  const selectBird = (id: string) => {
    const f = fixes.get(id);
    setBirdId(id);
    setTreeId(f?.det?.treeId ?? null);
    if (f?.det?.pos) setFocus({ pos: f.det.pos, key: Date.now() });
    else if (f?.det?.zoneId) {
      const z = MONITOR_ZONE_BY_ID[f.det.zoneId];
      const mid = z.sector ? (((z.sector[0] + z.sector[1]) / 2) * Math.PI) / 180 : 0;
      const r = z.sector ? 0.7 : 0;
      setFocus({ pos: { x: Math.cos(mid) * FOOTPRINT.rx * r, y: 2, z: Math.sin(mid) * FOOTPRINT.rz * r }, key: Date.now() });
    }
  };
  const selectTree = (id: string) => {
    const t = treeById.get(id);
    setBirdId(null);
    setTreeId(id);
    if (t) setFocus({ pos: { x: t.x, y: t.heightM * 0.55, z: t.z }, key: Date.now() });
  };
  // Opened from the registry (?bird=ID): select it and fly to it once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (paramBird && birdById.has(paramBird)) selectBird(paramBird);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramBird]);

  const checks = useMemo(() => runDemoChecks(ds, src, fixes, origin), [ds, src, origin, fixes]);
  const moves = useMemo(() => recentMoves(ds, asOf, 30 * MIN, 10), [ds, asOf]);

  const clearSelection = () => {
    setBirdId(null);
    setTreeId(null);
  };

  const highlightZone = zoneId ?? (selFix?.det?.kind === "zone" ? selFix.det.zoneId : null);

  const speciesCounts = useMemo(() => {
    const m = new Map<string, { total: number; detected: number }>();
    for (const f of fixes.values()) {
      if (!matchesText(f.bird)) continue;
      const c = m.get(f.bird.speciesId) ?? { total: 0, detected: 0 };
      c.total++;
      if (f.status === "detected" || f.status === "moving") c.detected++;
      m.set(f.bird.speciesId, c);
    }
    return m;
  }, [fixes, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const speciesList = MONITOR_SPECIES.filter((s) => (group === "all" || s.group === group) && (speciesCounts.get(s.id)?.total ?? 0) > 0);
  const showIndividuals = !!speciesId || !!q || !!zoneId || !!treeFilter;
  const activeFilters = [speciesId, zoneId, treeFilter, q || null].filter(Boolean).length + (group !== "all" ? 1 : 0) + (statuses.size < 4 ? 1 : 0) + (level !== "all" ? 1 : 0);
  const resetFilters = () => {
    setQuery("");
    setGroup("all");
    setSpeciesId(null);
    setZoneId(null);
    setTreeFilter(null);
    setLevel("all");
    setStatuses(new Set(STATUS_ORDER));
  };

  return (
    <div className="pb-12">
      <PageHeader
        eyebrow="Aviary · The Rainforest, Tropical Ocean"
        title="Aviary monitor"
        subtitle={
          <>
            Where each bird was last located, in which tree and at what height.{" "}
            <span className="ml-1 inline-flex items-center rounded-md bg-warn px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">DEMO / SIMULATED DATA</span>
          </>
        }
        actions={<ClockControl clock={clock} onClock={setClock} onRestart={restart} start={ds.windowStart} offsetMin={offsetMin} onOffset={setOffsetMin} />}
      />

      <div className="space-y-4 px-6 lg:px-8">
        <div role="note" className="flex items-start gap-2.5 rounded-xl border border-dashed border-warn/45 bg-warn/[0.06] px-3.5 py-2.5 text-xs text-muted">
          <Info size={15} className="mt-px shrink-0 text-warn" aria-hidden />
          <p>
            <span className="font-medium text-ink">DEMO / SIMULATED DATA.</span> The 32-species catalogue, the {registry.birds.length} birds, their ages, sexes, devices, trees, positions, heights and movements are fictional and generated for this demonstration. They are not SeaWorld Abu Dhabi’s collection or layout. Movement runs on a simulated clock; it is not real-time tracking.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[272px_minmax(0,1fr)_340px]">
          {/* ---------- Left: search + species ---------- */}
          <aside className="panel flex min-h-0 flex-col p-4 xl:h-[720px]" aria-label="Species and individuals">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-ink">Species</h2>
              {activeFilters > 0 && (
                <button onClick={resetFilters} className="text-[11px] font-medium text-accent hover:underline">
                  Clear filters ({activeFilters})
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted">
              {registry.species.length} species · {registry.birds.length} individuals <span className="text-faint">· demo data</span>
            </p>
            <label className="relative mt-3 block">
              <span className="sr-only">Search birds by ID, species or name</span>
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setListLimit(60);
                }}
                placeholder="Search ID, species or name…"
                className="h-9 w-full rounded-xl border border-line-strong bg-panel-solid pl-8 pr-8 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/60"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-faint hover:text-ink" aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {GROUPS.map((g) => (
                <Chip key={g.id} active={group === g.id} onClick={() => (setGroup(g.id), setSpeciesId(null))}>
                  {g.label}
                </Chip>
              ))}
            </div>

            <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto pr-1 max-xl:max-h-[420px]">
              {showIndividuals ? (
                <IndividualList
                  fixes={visible}
                  limit={listLimit}
                  onMore={() => setListLimit((n) => n + 100)}
                  selectedId={birdId}
                  onSelect={selectBird}
                  header={
                    speciesId ? (
                      <button onClick={() => setSpeciesId(null)} className="mb-2 flex w-full items-center justify-between rounded-lg bg-ink/[0.04] px-2.5 py-1.5 text-left text-xs">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: MONITOR_SPECIES_BY_ID[speciesId].color }} />
                          <span className="truncate font-medium text-ink">{MONITOR_SPECIES_BY_ID[speciesId].common}</span>
                        </span>
                        <span className="flex items-center gap-1 text-muted">
                          All species <X size={12} />
                        </span>
                      </button>
                    ) : null
                  }
                />
              ) : (
                <ul className="space-y-0.5">
                  {speciesList.map((s) => {
                    const c = speciesCounts.get(s.id)!;
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => (setSpeciesId(s.id), setListLimit(60))}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-ink/[0.04]"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-bold text-white" style={{ background: s.color }} aria-hidden>
                            {s.code}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">{s.common}</span>
                            <span className="block truncate text-[11px] italic text-muted">{s.scientific}</span>
                          </span>
                          <span className="num text-right text-xs">
                            <span className="font-semibold text-ink">{c.total}</span>
                            <span className="block text-[10px] text-ok" title="Detected or moving in the last 10 minutes">
                              {c.detected} live
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="mt-3 border-t border-line pt-2 text-[10px] leading-snug text-faint">
              Demo catalogue for this presentation. Counts and individuals are fictional and do not represent any real collection.
            </p>
          </aside>

          {/* ---------- Centre: map ---------- */}
          <section className="panel flex min-w-0 flex-col overflow-hidden" aria-label="Aviary map">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
              <div className="scroll-thin max-w-full overflow-x-auto">
                <Segmented
                  size="sm"
                  value={level}
                  onChange={setLevel}
                  options={[{ value: "all" as const, label: "All levels" }, ...LEVELS.map((l) => ({ value: l.id, label: l.id === "upper" ? "> 18 m" : l.id === "ground" ? "Ground" : `${l.short.replace("Level ", "L")} · ${l.min === 0.5 ? 0 : l.min}–${l.max} m` }))]}
                />
              </div>
              <div className="ml-auto">
                <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "2d", label: "2D" }, { value: "3d", label: "3D" }]} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show by status">
                {STATUS_ORDER.map((s) => (
                  <Chip
                    key={s}
                    active={statuses.has(s)}
                    color={FIX_STATUS[s].color}
                    onClick={() =>
                      setStatuses((prev) => {
                        const next = new Set(prev);
                        if (next.has(s)) next.delete(s);
                        else next.add(s);
                        return next.size ? next : new Set(STATUS_ORDER);
                      })
                    }
                  >
                    <span title={FIX_STATUS[s].hint}>{FIX_STATUS[s].label}</span>
                  </Chip>
                ))}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <MiniSelect label="Zone" value={zoneId ?? ""} onChange={(v) => setZoneId(v || null)}>
                  <option value="">All zones</option>
                  {MONITOR_ZONES.map((z) => (
                    <option key={z.id} value={z.id}>{z.code} · {z.name}</option>
                  ))}
                </MiniSelect>
                <MiniSelect label="Tree" value={treeFilter ?? ""} onChange={(v) => setTreeFilter(v || null)}>
                  <option value="">All trees</option>
                  {registry.trees.map((t) => (
                    <option key={t.id} value={t.id}>{t.id} · {MONITOR_ZONE_BY_ID[t.zoneId].code} · {t.heightM.toFixed(0)} m</option>
                  ))}
                </MiniSelect>
                <Segmented size="sm" value={colorBy} onChange={setColorBy} options={[{ value: "status", label: "Status" }, { value: "species", label: "Species" }]} />
              </div>
            </div>
            <div className="relative h-[460px] sm:h-[540px] xl:h-auto xl:flex-1">
              <AviaryScene
                trees={registry.trees}
                structures={STRUCTURES}
                points={points}
                selectedBirdId={birdId}
                selectedTreeId={treeId ?? treeFilter}
                highlightZoneId={highlightZone}
                precision={selFix?.det?.pos && selFix.det.precisionM ? { pos: selFix.det.pos, r: selFix.det.precisionM } : null}
                trail={trail}
                level={level}
                mode={mode}
                focus={focus}
                dimTrees={level !== "all"}
                onSelectBird={selectBird}
                onSelectTree={selectTree}
                onSelectZone={(id) => setZoneId((z) => (z === id ? null : id))}
              />
              <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/85 px-2.5 py-1.5 text-[11px] text-muted shadow-sm backdrop-blur">
                <span className="num font-semibold text-ink">{points.filter((p) => !p.dim).length}</span> on map ·{" "}
                <span className="num">{visible.length - points.filter((p) => !p.dim).length}</span> without coordinates
                {offsetMin > 0 && <span className="ml-1 font-medium text-warn">· as of {fmtDateTime(asOf, now)}</span>}
              </div>
            </div>
          </section>

          {/* ---------- Right: detail ---------- */}
          <aside className="space-y-4 xl:h-[720px] xl:overflow-y-auto xl:pr-1 scroll-thin" aria-label="Selection details">
            {selFix ? (
              <BirdCard
                fix={selFix}
                asOf={asOf}
                now={now}
                tab={tab}
                onTab={setTab}
                win={win}
                onWin={setWin}
                showTrail={showTrail}
                onTrail={setShowTrail}
                onClose={clearSelection}
                onCenter={() => selectBird(selFix.bird.id)}
                onTree={selectTree}
              />
            ) : selTree ? null : (
              <div className="panel p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Crosshair size={16} className="text-accent" /> Select a bird or a tree
                </div>
                <p className="mt-2 text-xs text-muted">
                  Click a dot on the map or pick a bird from the list to see its last location, tree, height and history. Click a tree to see its structure and the birds located in it.
                </p>
                <dl className="mt-4 space-y-2 text-xs">
                  {(Object.keys(LOCATION_KIND) as LocationKind[]).map((k) => (
                    <div key={k} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_COLOR[k] }} />
                      <div>
                        <dt className="font-medium text-ink">{LOCATION_KIND[k].label}</dt>
                        <dd className="text-muted">{LOCATION_KIND[k].hint}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {selTree && (
              <TreeCard
                tree={selTree}
                colorBy={colorBy}
                fixes={fixes}
                asOf={asOf}
                now={now}
                compact={!!selFix}
                selectedBirdId={birdId}
                onSelectBird={selectBird}
                onClose={() => setTreeId(null)}
                history={!selFix}
                ds={ds}
                src={src}
              />
            )}
          </aside>
        </div>

        <BottomPanels fixes={visible} all={fixes} ds={ds} src={src} asOf={asOf} level={level} onLevel={setLevel} zoneId={zoneId} onZone={setZoneId} />

        <div className="grid gap-4 lg:grid-cols-2">
          <MovementFeed moves={moves} asOf={asOf} onSelect={selectBird} />
          <ChecksCard checks={checks} />
        </div>
      </div>
    </div>
  );
}

/* ---------- pieces ---------- */

function TreeCard({ tree, colorBy, fixes, asOf, now, compact, selectedBirdId, onSelectBird, onClose, history, ds, src }: {
  tree: AviaryTree;
  colorBy: "status" | "species";
  fixes: Map<string, Fix>;
  asOf: number;
  now: number;
  compact: boolean;
  selectedBirdId: string | null;
  onSelectBird: (id: string) => void;
  onClose: () => void;
  history: boolean;
  ds: TrackingDataset;
  src: TrackingSource;
}) {
  const occ = treeOccupants(fixes, tree.id);
  const side: SideBird[] = occ.map((f) => ({
    id: f.bird.id,
    heightM: f.det!.pos!.y,
    precisionM: f.det!.precisionM ?? 1,
    dx: f.det!.pos!.x - tree.x,
    color: colorBy === "species" ? MONITOR_SPECIES_BY_ID[f.bird.speciesId].color : FIX_STATUS[f.status].color,
    kind: f.det!.kind,
  }));
  const hist = history ? treeHistory(ds, src, tree.id, asOf - DAY, asOf).filter((r) => r.start <= asOf) : [];
  const lastActivity = Math.max(...occ.map((f) => f.det!.at), ...hist.map((r) => Math.min(r.end, asOf)), -Infinity);
  const levels = LEVELS.filter((l) => l.min < tree.heightM && l.id !== "ground").map((l) => l.short);
  return (
    <section className="panel p-4" aria-label={`Tree ${tree.id}`}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="eyebrow">{compact ? "Associated tree" : "Tree"}</p>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <TreePine size={17} className="text-accent" /> {tree.id}
            <span className="text-xs font-normal text-muted">· {MONITOR_ZONE_BY_ID[tree.zoneId].code} {MONITOR_ZONE_BY_ID[tree.zoneId].name}</span>
          </h2>
        </div>
        {!compact && (
          <button onClick={onClose} className="rounded-lg p-1 text-faint hover:bg-ink/5 hover:text-ink" aria-label="Close tree">
            <X size={16} />
          </button>
        )}
      </header>
      {!compact && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Field k="Plant species" v={tree.plantSpecies ?? <span className="text-muted">Not set (demo tree)</span>} />
          <Field k="Form" v={`${tree.form[0].toUpperCase()}${tree.form.slice(1)} (schematic)`} />
          <Field k="Total height" v={`${tree.heightM.toFixed(1)} m`} />
          <Field k="Coordinates" v={<span className="num">X {tree.x.toFixed(1)} · Y {tree.z.toFixed(1)} m</span>} />
            <Field k="Reference points" v={<span className="num">{tree.branchTiersM.map((h, i) => `R${i + 1} ${h.toFixed(1)} m`).join(" · ")}</span>} />
          <Field k="Levels" v={levels.join(", ")} />
          <Field k="Birds now" v={<span className="num font-semibold">{occ.length}</span>} />
          <Field k="Last activity" v={Number.isFinite(lastActivity) ? `${fmtTime(lastActivity)} · ${fmtAgo(lastActivity, asOf)}` : "None in 24 h"} />
          <Field k="Data" v={<Badge>Simulated</Badge>} />
        </dl>
      )}
      <div className="mt-3">
        <TreeSideView tree={tree} birds={side} selectedBirdId={selectedBirdId} onSelectBird={onSelectBird} />
      </div>
      {!compact && (
        <>
          <h3 className="mt-4 text-xs font-semibold text-ink">Birds located in {tree.id} ({occ.length})</h3>
          {occ.length ? (
            <ul className="mt-1.5 space-y-1">
              {occ.map((f) => (
                <li key={f.bird.id}>
                  <button onClick={() => onSelectBird(f.bird.id)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-ink/[0.04]">
                    <span className="h-2 w-2 rounded-full" style={{ background: FIX_STATUS[f.status].color }} />
                    <span className="font-mono font-medium text-ink">{f.bird.id}</span>
                    <span className="truncate text-muted">{MONITOR_SPECIES_BY_ID[f.bird.speciesId].common}</span>
                    <span className="num ml-auto text-muted">{fmtHeight(f.det!.pos!.y)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted">No bird is located in this tree right now. Zone-level detections are never assigned to a tree.</p>
          )}
          <h3 className="mt-4 text-xs font-semibold text-ink">Detection history · last 24 h ({hist.length})</h3>
          <ul className="scroll-thin mt-1.5 max-h-44 space-y-0.5 overflow-y-auto text-xs">
            {hist.slice(0, 60).map((r, i) => (
              <li key={`${r.birdId}-${r.start}-${i}`} className="flex items-center gap-2 px-1.5 py-0.5">
                <span className="num w-[86px] shrink-0 text-muted">{fmtTime(r.start)}–{fmtTime(Math.min(r.end, asOf))}</span>
                <button onClick={() => onSelectBird(r.birdId)} className="font-mono text-ink hover:text-accent">{r.birdId}</button>
                <span className="num ml-auto text-muted">{fmtHeight(r.heightM)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-faint">Demo clock {fmtDateTime(now, now)}.</p>
        </>
      )}
    </section>
  );
}


function MiniSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="inline-flex items-center gap-1 text-[11px] text-muted">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-7 max-w-[150px] rounded-lg border border-line-strong bg-panel-solid px-2 text-xs text-ink outline-none focus:border-accent/60">
        {children}
      </select>
    </label>
  );
}

function ClockControl({ clock, onClock, onRestart, start, offsetMin, onOffset }: {
  clock: { simTime: number; speed: number; playing: boolean };
  onClock: (p: Partial<{ speed: number; playing: boolean }>) => void;
  onRestart: () => void;
  start: number;
  offsetMin: number;
  onOffset: (m: number) => void;
}) {
  const max = Math.max(60, Math.floor((clock.simTime - start) / MIN) - 60);
  return (
    <div className="panel flex flex-col gap-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-warn">Simulated clock</span>
        <span className="num text-sm font-semibold text-ink">{fmtDateTime(clock.simTime, clock.simTime)}</span>
        <button
          onClick={() => onClock({ playing: !clock.playing })}
          className="inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2 text-xs font-medium text-white"
          aria-label={clock.playing ? "Pause simulation" : "Play simulation"}
        >
          {clock.playing ? <Pause size={13} /> : <Play size={13} />} {clock.playing ? "Pause" : "Play"}
        </button>
        <Segmented size="sm" value={String(clock.speed)} onChange={(v) => onClock({ speed: Number(v) })} options={SPEEDS.map((o) => ({ value: o.value as string, label: o.label }))} />
        <button onClick={onRestart} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-ink/5 hover:text-ink" title="Restart the simulated clock" aria-label="Restart the simulated clock">
          <RotateCcw size={13} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {TIME_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onOffset(p.min)}
            className={cx("h-6 rounded-md px-1.5 text-[11px] font-medium", offsetMin === p.min ? "bg-ink/10 text-ink" : "text-muted hover:bg-ink/5 hover:text-ink")}
          >
            {p.label}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="sr-only">Look back in time</span>
          <input
            type="range"
            min={0}
            max={max}
            step={15}
            value={max - Math.min(offsetMin, max)}
            onChange={(e) => onOffset(max - Number(e.target.value))}
            className="w-28 accent-[var(--accent)]"
            aria-valuetext={offsetMin ? `${Math.round(offsetMin / 60)} hours earlier` : "Current simulated time"}
          />
          {offsetMin > 0 && <span className="num whitespace-nowrap text-warn">viewing {fmtDateTime(clock.simTime - offsetMin * MIN, clock.simTime)}</span>}
        </label>
      </div>
    </div>
  );
}

function MovementFeed({ moves, asOf, onSelect }: { moves: ReturnType<typeof recentMoves>; asOf: number; onSelect: (id: string) => void }) {
  return (
    <section className="panel p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <ArrowRight size={15} className="text-accent" /> Recent movements <Badge>Simulated</Badge>
      </h2>
      <p className="mt-0.5 text-[11px] text-muted">Arrivals at a new tree in the last 30 simulated minutes. Each one updates the bird’s coordinates, height, tree and history.</p>
      {moves.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">No movements in this period (birds roost at night).</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {moves.map((m) => (
            <li key={m.id}>
              <button onClick={() => onSelect(m.birdId)} className="grid w-full grid-cols-[48px_72px_1fr_auto] items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-ink/[0.04]">
                <span className="num text-muted">{fmtTime(m.at)}</span>
                <span className="font-mono font-semibold text-ink">{m.birdId}</span>
                <span className="truncate text-muted">
                  {m.fromTreeId ?? "—"} → <span className="font-medium text-ink">{m.toTreeId}</span> · {MONITOR_ZONE_BY_ID[m.zoneId].code} · {m.heightM.toFixed(1)} m
                </span>
                <span className="num text-[10px] text-faint">{fmtAgo(m.at, asOf)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ChecksCard({ checks }: { checks: ReturnType<typeof runDemoChecks> }) {
  const ok = checks.filter((c) => c.pass).length;
  return (
    <section className="panel p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <ShieldCheck size={15} className="text-accent" /> Demo data checks
        <Badge tone={ok === checks.length ? "ok" : "danger"}>
          {ok}/{checks.length} passed
        </Badge>
      </h2>
      <ul className="mt-2 space-y-1.5">
        {checks.map((c) => (
          <li key={c.id} className="flex gap-2 text-xs">
            {c.pass ? <CheckCircle2 size={14} className="mt-px shrink-0 text-ok" /> : <XCircle size={14} className="mt-px shrink-0 text-danger" />}
            <span>
              <span className="font-medium text-ink">{c.label}</span>
              <span className="block text-[11px] text-muted">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => window.confirm("Generate a new demo registry? The demo birds, trees and clock stored in this browser are replaced.") && resetDemoData()}
        className="mt-3 text-[11px] font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
      >
        Reset demo data
      </button>
    </section>
  );
}

function IndividualList({ fixes, limit, onMore, selectedId, onSelect, header }: {
  fixes: Fix[];
  limit: number;
  onMore: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  header: ReactNode;
}) {
  const rows = [...fixes].sort((a, b) => a.bird.id.localeCompare(b.bird.id));
  return (
    <div>
      {header}
      <p className="mb-1.5 text-[11px] text-muted">{rows.length} individuals</p>
      {rows.length === 0 && <p className="py-6 text-center text-xs text-muted">No bird matches these filters.</p>}
      <ul className="space-y-0.5">
        {rows.slice(0, limit).map((f) => {
          const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
          const d = f.det;
          return (
            <li key={f.bird.id}>
              <button
                onClick={() => onSelect(f.bird.id)}
                aria-current={selectedId === f.bird.id}
                className={cx("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left", selectedId === f.bird.id ? "bg-accent/12" : "hover:bg-ink/[0.04]")}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: FIX_STATUS[f.status].color }} title={FIX_STATUS[f.status].label} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-mono text-xs font-semibold text-ink">{f.bird.id}</span>
                    {f.bird.name && <span className="truncate text-[11px] text-muted">“{f.bird.name}”</span>}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {sp.common} · {d?.zoneId ? MONITOR_ZONE_BY_ID[d.zoneId].code : "—"}
                    {d?.treeId ? ` · ${d.treeId}` : ""}
                    {d?.pos ? ` · ${d.pos.y.toFixed(1)} m` : d?.kind === "zone" ? " · zone only" : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length > limit && (
        <button onClick={onMore} className="mt-2 w-full rounded-lg border border-line-strong py-1.5 text-xs text-muted hover:text-ink">
          Show more ({rows.length - limit})
        </button>
      )}
    </div>
  );
}

function Field({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-faint">{k}</dt>
      <dd className="mt-0.5 text-ink">{v}</dd>
    </div>
  );
}

function BirdCard({ fix, asOf, now, tab, onTab, win, onWin, showTrail, onTrail, onClose, onCenter, onTree }: {
  fix: Fix;
  asOf: number;
  now: number;
  tab: "info" | "location" | "history";
  onTab: (t: "info" | "location" | "history") => void;
  win: WindowId;
  onWin: (w: WindowId) => void;
  showTrail: boolean;
  onTrail: (v: boolean) => void;
  onClose: () => void;
  onCenter: () => void;
  onTree: (id: string) => void;
}) {
  const { src } = useTracking();
  const { bird, det, status } = fix;
  const sp = MONITOR_SPECIES_BY_ID[bird.speciesId];
  const quality = dataQuality(fix);
  const rows = useMemo(() => historyRows(bird, src.history(bird.id, asOf - WINDOWS[win], asOf), asOf), [bird, src, asOf, win]);
  const kind: LocationKind = det?.kind ?? "unknown";
  const level = det?.pos ? levelOf(det.pos.y) : null;

  return (
    <section className="panel overflow-hidden" aria-label={`Bird ${bird.id}`}>
      <div className="relative grid h-28 place-items-center" style={{ background: `linear-gradient(135deg, ${sp.color}33, ${sp.color}88)` }}>
        <Feather size={34} style={{ color: sp.color }} aria-hidden />
        <span className="absolute bottom-2 left-3 rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-muted">Reference photo · to be provided by SeaWorld</span>
        <button onClick={onClose} className="absolute right-2 top-2 rounded-lg bg-white/80 p-1 text-muted hover:text-ink" aria-label="Close bird">
          <X size={15} />
        </button>
      </div>
      <div className="p-4">
        <p className="font-mono text-xs font-semibold text-muted">
          {bird.id}
          {bird.name && <span className="font-sans font-normal"> · “{bird.name}”</span>}
        </p>
        <h2 className="text-lg font-semibold leading-tight text-ink">{sp.common}</h2>
        <p className="text-xs italic text-muted">{sp.scientific}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone={STATUS_TONE[status]}>{FIX_STATUS[status].label}</Badge>
          <Badge tone={quality.tone}>Quality: {quality.label}</Badge>
        </div>

        <div className="mt-3 flex border-b border-line text-xs" role="tablist">
          {(["info", "location", "history"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => onTab(t)}
              className={cx("-mb-px border-b-2 px-3 py-2 font-medium capitalize", tab === t ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}
            >
              {t === "info" ? "Information" : t}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
            <Field k="ID" v={<span className="font-mono">{bird.id}</span>} />
            <Field k="Species code" v={sp.code} />
            <Field k="Common name" v={sp.common} />
            <Field k="Scientific name" v={<i>{sp.scientific}</i>} />
            <Field k="Spanish name" v={sp.commonEs} />
            <Field k="Age" v={`${AGE_LABEL[bird.ageClass]} · ${bird.ageYears.toFixed(1)} y`} />
            <Field k="Sex" v={bird.sex ? bird.sex[0].toUpperCase() + bird.sex.slice(1) : <span className="text-muted">{sp.dimorphic ? "Not distinguishable yet" : "Not recorded"}</span>} />
            <Field k="Home zone" v={`${MONITOR_ZONE_BY_ID[bird.homeZoneId].code} · ${MONITOR_ZONE_BY_ID[bird.homeZoneId].name}`} />
            <Field k="Device" v={<span className="font-mono">{bird.device.id}</span>} />
            <Field
              k="Device status"
              v={
                <>
                  {DEVICE_STATUS_LABEL[bird.device.status]}
                  <span className="text-muted"> · {bird.device.batteryPct}%</span>
                </>
              }
            />
            <div className="col-span-2 rounded-lg bg-ink/[0.03] px-2.5 py-2 text-[11px] text-muted">
              All values are fictional demo data. A real device would be chosen by species size, admissible weight, battery life, coverage and veterinary approval.
            </div>
          </dl>
        )}

        {tab === "location" && (
          <div className="mt-3">
            <div className="mb-3 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs" style={{ background: `${KIND_COLOR[kind]}14` }}>
              <MapPin size={14} style={{ color: KIND_COLOR[kind] }} />
              <div>
                <p className="font-semibold text-ink">{LOCATION_KIND[kind].label}</p>
                <p className="text-muted">{LOCATION_KIND[kind].hint}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <Field k="Zone" v={det?.zoneId ? `${MONITOR_ZONE_BY_ID[det.zoneId].code} · ${MONITOR_ZONE_BY_ID[det.zoneId].name}` : "—"} />
              <Field
                k="Tree"
                v={det?.treeId ? <button onClick={() => onTree(det.treeId!)} className="font-medium text-accent hover:underline">{det.treeId}</button> : <span className="text-muted">{det?.pos ? (det.moving ? "In transit" : "Not in a tree") : "Not determinable"}</span>}
              />
              <Field k="Estimated height" v={det?.pos ? fmtHeight(det.pos.y) : "—"} />
              <Field k="Level" v={level ? level.short : "—"} />
              <Field k="Branch" v={<span className="text-muted">Not determined</span>} />
              <Field k="Precision" v={det?.precisionM != null ? `± ${det.precisionM.toFixed(1)} m` : det?.kind === "zone" ? "Zone level" : "—"} />
              <Field k="Last detection" v={det ? `${fmtTime(det.at)} · ${fmtAgo(det.at, asOf)}` : "Never"} />
              <Field k="Source" v={det ? det.source[0].toUpperCase() + det.source.slice(1) : "—"} />
              <Field k="Coordinates" v={det?.pos ? <span className="num">X {det.pos.x.toFixed(1)} · Y {det.pos.z.toFixed(1)} · Z {det.pos.y.toFixed(1)}</span> : "Not available"} />
              <Field k="Signal quality" v={det ? SIGNAL_LABEL[status === "no-signal" ? "none" : det.signal] : "None"} />
              <Field k="Location confidence" v={det ? `${Math.round(det.confidence * 100)}%` : "—"} />
              <Field k="Movement" v={det?.moving == null ? "Not determinable" : det.moving ? "In transit" : "Perched / stationary"} />
            </dl>
            <p className="mt-2 text-[10px] text-faint">Precision values are simulated · pending validation. Coordinates are on the conceptual layout (Z = height). Simulated clock {fmtDateTime(now, now)}.</p>
            {!det?.pos && (
              <p className="mt-2 rounded-lg bg-warn/[0.08] px-2.5 py-2 text-[11px] text-ink">
                {det?.kind === "zone"
                  ? "Only the zone is known. The map highlights the zone instead of placing a dot."
                  : "No valid location. The map does not place this bird."}
              </p>
            )}
            <button onClick={onCenter} disabled={!det} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-line-strong text-sm text-ink hover:border-accent/50 disabled:opacity-40">
              <Crosshair size={15} /> Center on map
            </button>
          </div>
        )}

        {tab === "history" && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <Segmented size="sm" value={win} onChange={onWin} options={[{ value: "6h" as const, label: "6 h" }, { value: "24h" as const, label: "24 h" }, { value: "7d" as const, label: "7 days" }]} />
              {bird.device.status !== "intermittent" && (
                <label className="flex items-center gap-1.5 text-[11px] text-muted">
                  <input type="checkbox" checked={showTrail} onChange={(e) => onTrail(e.target.checked)} className="accent-[var(--accent)]" /> Path on map
                </label>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted">{rows.length} locations · device {DEVICE_STATUS_LABEL[bird.device.status].toLowerCase()}</p>
            {rows.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">No locations in this period.</p>
            ) : (
              <ol className="scroll-thin mt-1.5 max-h-72 space-y-1 overflow-y-auto">
                {rows.map((r) => (
                  <li key={r.id} className="grid grid-cols-[78px_1fr_auto] items-center gap-2 rounded-md px-1.5 py-1 text-xs odd:bg-ink/[0.025]">
                    <span className="num text-muted">{fmtTime(r.start)}–{fmtTime(Math.min(r.end, asOf))}</span>
                    <span className="truncate text-ink">
                      {MONITOR_ZONE_BY_ID[r.zoneId].code}
                      {r.treeId ? ` · ${r.treeId}` : ""}
                      {r.heightM != null ? ` · ${r.heightM.toFixed(1)} m` : ""}
                    </span>
                    <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[r.kind] }} title={LOCATION_KIND[r.kind].label} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function BottomPanels({ fixes, all, ds, src, asOf, level, onLevel, zoneId, onZone }: {
  fixes: Fix[];
  all: Map<string, Fix>;
  ds: ReturnType<typeof useTracking>["ds"];
  src: ReturnType<typeof useTracking>["src"];
  asOf: number;
  level: LevelId | "all";
  onLevel: (l: LevelId | "all") => void;
  zoneId: string | null;
  onZone: (z: string | null) => void;
}) {
  const byZone = MONITOR_ZONES.map((z) => ({ zone: z, n: fixes.filter((f) => f.det?.zoneId === z.id).length }));
  const noZone = fixes.filter((f) => !f.det?.zoneId).length;
  const withHeight = fixes.filter((f) => f.levelId);
  const byLevel = LEVELS.map((l) => ({ l, n: withHeight.filter((f) => f.levelId === l.id).length }));
  const byStatus = STATUS_ORDER.map((s) => ({ s, n: fixes.filter((f) => f.status === s).length }));
  const byKind = (Object.keys(LOCATION_KIND) as LocationKind[]).map((k) => ({ k, n: fixes.filter((f) => (f.det?.kind ?? "unknown") === k).length }));
  // Recomputed every 5 simulated minutes, not on every clock tick.
  const bucket = Math.floor(asOf / (5 * MIN)) * 5 * MIN;
  const activity = useMemo(() => activityByHour(ds, src, bucket), [ds, src, bucket]);
  const total = fixes.length;
  const pct = (n: number, d = total) => (d ? `${Math.round((n / d) * 100)}%` : "—");

  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-[1fr_1fr_1.3fr]">
      <section className="panel p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><MapPin size={15} className="text-accent" /> Distribution by zone</h2>
        <div className="mt-3 flex items-center gap-4">
          <Donut
            size={124}
            parts={[...byZone.map((b) => ({ value: b.n, color: b.zone.color, label: `${b.zone.code} ${b.zone.name}` })), { value: noZone, color: "#CBD5E1", label: "No location" }]}
            center={<span><span className="num block text-xl font-semibold text-ink">{total}</span><span className="text-[10px] text-muted">birds</span></span>}
          />
          <ul className="min-w-0 flex-1 space-y-1 text-xs">
            {byZone.map(({ zone, n }) => (
              <li key={zone.id}>
                <button onClick={() => onZone(zoneId === zone.id ? null : zone.id)} className={cx("flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-ink/[0.04]", zoneId === zone.id && "bg-accent/10")}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: zone.color }} />
                  <span className="truncate text-muted">{zone.code} · {zone.name}</span>
                  <span className="num ml-auto font-semibold text-ink">{n}</span>
                  <span className="num w-9 text-right text-faint">{pct(n)}</span>
                </button>
              </li>
            ))}
            <li className="flex items-center gap-2 px-1 py-0.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
              <span className="text-muted">No location</span>
              <span className="num ml-auto font-semibold text-ink">{noZone}</span>
              <span className="num w-9 text-right text-faint">{pct(noZone)}</span>
            </li>
          </ul>
        </div>
        <p className="mt-2 text-[10px] text-faint">Zone of the last detection, including zone-only and old detections.</p>
      </section>

      <section className="panel p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Layers size={15} className="text-accent" /> Birds by height level</h2>
        <div className="mt-3">
          <BarList
            items={byLevel.map(({ l, n }) => ({ key: l.id, label: l.label, value: n, color: l.color, hint: pct(n, withHeight.length) }))}
            onSelect={(k) => onLevel(level === k ? "all" : (k as LevelId))}
            selected={level === "all" ? [] : [level]}
          />
        </div>
        <p className="mt-3 text-[10px] text-faint">
          {withHeight.length} birds with an estimated height. {total - withHeight.length} have no height (weak signal: zone only, or no location) and are not assigned a level. Ranges are provisional.
        </p>
      </section>

      <section className="panel p-4 lg:col-span-2 2xl:col-span-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Activity size={15} className="text-accent" /> Activity and detection quality</h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {byStatus.map(({ s, n }) => (
            <div key={s} className="rounded-lg border border-line px-2 py-1.5">
              <p className="flex items-center gap-1 text-[10px] text-muted"><span className="h-1.5 w-1.5 rounded-full" style={{ background: FIX_STATUS[s].color }} />{FIX_STATUS[s].label}</p>
              <p className="num text-lg font-semibold text-ink">{n}</p>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <SplitBar title="Location type" parts={byKind.map(({ k, n }) => ({ value: n, color: KIND_COLOR[k], label: LOCATION_KIND[k].label }))} />
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
            {byKind.map(({ k, n }) => (
              <span key={k} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_COLOR[k] }} />{LOCATION_KIND[k].label} {pct(n)}</span>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <LineChart
            height={120}
            format={(v) => String(Math.round(v))}
            data={activity.map((b) => ({ label: fmtTime(b.at), values: { detected: b.detected, moving: b.moving } }))}
            series={[
              { key: "detected", color: "#16A34A", label: "Birds detected", area: true },
              { key: "moving", color: "#2563EB", label: "Birds that moved" },
            ]}
          />
          <p className="text-[10px] text-faint">Last 24 h, whole aviary ({all.size} birds). Simulated.</p>
        </div>
      </section>
    </div>
  );
}
