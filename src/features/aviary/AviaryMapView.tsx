"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Layers, Maximize2, Minimize2, Pause, Play, TreePine, X } from "lucide-react";
import {
  FIX_STATUS,
  LEVELS,
  MONITOR_ZONES,
  MONITOR_ZONE_BY_ID,
  levelOf,
  type AviaryTree,
  type FixStatus,
  type LevelId,
  type Vec3,
} from "@/domain/aviaryTracking";
import { MONITOR_SPECIES, MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { MONITOR_TEAMS, MONITOR_TEAM_BY_ID, type TeamId } from "@/data/aviaryTeams";
import { useTeamAssignments } from "@/state/useTeams";
import { SpeciesSection, TeamsSection } from "./AviaryPanels";
import { activityByHour, fmtHeight, snapshot, treeHistory, treeOccupants, type Fix } from "@/logic/aviaryTracking";
import { HOUR, MIN, fmtTime } from "@/logic/time";
import { useSimClock, useTracking, type TrackingState } from "@/state/useTracking";
import { Segmented, cx } from "@/components/ui/primitives";
import { Donut, LineChart } from "@/components/charts/Charts";
import { DEFAULT_SCENE_LAYERS, type SceneLayers, type ScenePoint } from "./monitor/AviaryScene";
import { AviaryScene, BirdCard, type BirdTab, STATUS_ORDER, WINDOWS, type WindowId } from "./monitor/AviaryParts";
import { AviaryImageMap, type ZoneStat } from "./monitor/AviaryImageMap";
import { SpeciesAvatar } from "./SpeciesAvatar";
import { TreeIllustration, type TreeBird } from "./TreeIllustration";

const LEVEL_SHORT: Record<LevelId, string> = { upper: "UC", l3: "L3", l2: "L2", l1: "L1", ground: "G" };

type Layers3D = SceneLayers & { trail: boolean };

/** Aviary Habitat map: species with images, 3D map, the selected tree and bird cards. */
export function AviaryMapView() {
  const t = useTracking();
  // A reset creates a new registry: remount so every piece of state starts over.
  return <MapInner key={t.registry.createdAt} {...t} />;
}

function zoneCenter(zoneId: string): Vec3 {
  const z = MONITOR_ZONE_BY_ID[zoneId];
  if (!z.sector) return { x: 0, y: 2, z: 0 };
  const mid = (((z.sector[0] + z.sector[1]) / 2) * Math.PI) / 180;
  return { x: Math.cos(mid) * 58 * 0.7, y: 2, z: Math.sin(mid) * 38 * 0.7 };
}

function MapInner({ registry, ds, src, treeById, birdById }: TrackingState) {
  const params = useSearchParams();
  const { clock, set: setClock } = useSimClock(registry, ds.horizon);
  const asOf = clock.simTime;
  const fixes = useMemo(() => snapshot(ds, src, asOf), [ds, src, asOf]);
  const all = useMemo(() => [...fixes.values()], [fixes]);

  const paramBird = params.get("bird");
  const paramTree = params.get("tree");
  const [birdId, setBirdId] = useState<string | null>(paramBird && birdById.has(paramBird) ? paramBird : null);
  const [treeId, setTreeId] = useState<string | null>(() => {
    if (paramBird && birdById.has(paramBird)) return fixes.get(paramBird)?.det?.treeId ?? null;
    return paramTree && treeById.has(paramTree) ? paramTree : null;
  });
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ pos: Vec3; key: number } | null>(() => {
    const d = paramBird ? fixes.get(paramBird)?.det : null;
    if (d?.pos) return { pos: d.pos, key: 1 };
    if (d?.zoneId) return { pos: zoneCenter(d.zoneId), key: 1 };
    const t = paramTree ? treeById.get(paramTree) : null;
    return t ? { pos: { x: t.x, y: t.heightM * 0.55, z: t.z }, key: 1 } : null;
  });

  const [speciesId, setSpeciesId] = useState(() => {
    const s = params.get("species");
    return s && MONITOR_SPECIES_BY_ID[s] ? s : "";
  });
  const [zoneId, setZoneId] = useState("");
  const [level, setLevel] = useState<LevelId | "all">("all");
  const [statusF, setStatusF] = useState<FixStatus | "">("");
  const [teamFilter, setTeamFilter] = useState<TeamId | "">(() => {
    const t = params.get("team");
    return t && t in MONITOR_TEAM_BY_ID ? (t as TeamId) : "";
  });
  const [treeView, setTreeView] = useState(false);
  const [maxed, setMaxed] = useState(false);
  // Birds that share an estimated spot even at the closest zoom, listed on the map.
  const [groupIds, setGroupIds] = useState<string[] | null>(null);
  const [grouping, setGrouping] = useState(true);
  // Esc leaves the maximised map (the selection stays).
  useEffect(() => {
    if (!maxed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMaxed(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maxed]);
  // Team assignments: automatic default split, plus the user's changes.
  const { teamOf, assign } = useTeamAssignments(registry);
  // The reference picture is the default view; the 3D model and its top view stay available.
  const [mode, setMode] = useState<"image" | "3d" | "2d">("image");
  const [layers, setLayers] = useState<Layers3D>({ ...DEFAULT_SCENE_LAYERS, trail: true });
  const [dimRest, setDimRest] = useState(true);
  // On the picture, birds are summarised by area first; picking an area shows its dots.
  const [aggregate, setAggregate] = useState(true);
  const smooth = true;
  const [tab, setTab] = useState<BirdTab>("location");
  const [win, setWin] = useState<WindowId>("6h");

  const matches = (f: Fix) => {
    if (speciesId && f.bird.speciesId !== speciesId) return false;
    if (teamFilter && teamOf(f.bird) !== teamFilter) return false;
    if (zoneId && f.det?.zoneId !== zoneId) return false;
    if (statusF && f.status !== statusF) return false;
    return true;
  };
  const isActive = (f: Fix) => matches(f) && (level === "all" || f.levelId === level);
  const zoneStats: ZoneStat[] = useMemo(() => {
    const byZone = new Map<string, Fix[]>();
    for (const f of all) {
      if (speciesId && f.bird.speciesId !== speciesId) continue;
      if (teamFilter && teamOf(f.bird) !== teamFilter) continue;
      if (statusF && f.status !== statusF) continue;
      if (level !== "all" && f.levelId !== level) continue;
      const z = f.det?.zoneId;
      if (!z) continue;
      const list = byZone.get(z);
      if (list) list.push(f);
      else byZone.set(z, [f]);
    }
    return MONITOR_ZONES.map((z) => {
      const list = byZone.get(z.id) ?? [];
      const sp = new Map<string, number>();
      for (const f of list) sp.set(f.bird.speciesId, (sp.get(f.bird.speciesId) ?? 0) + 1);
      return {
        zoneId: z.id,
        count: list.length,
        detected: list.filter((f) => f.status === "detected" || f.status === "moving").length,
        noSignal: list.filter((f) => f.status === "no-signal").length,
        species: [...sp.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ name: MONITOR_SPECIES_BY_ID[id].common, color: MONITOR_SPECIES_BY_ID[id].color, n })),
      };
    });
  }, [all, speciesId, teamFilter, statusF, level, teamOf]);
  const filtered = !!teamFilter || !!speciesId || !!zoneId || !!statusF;

  const points: ScenePoint[] = useMemo(() => {
    const out: ScenePoint[] = [];
    for (const f of all) {
      if (!f.det?.pos) continue;
      const active = isActive(f);
      if (!active && !dimRest && (filtered || level !== "all")) continue;
      const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
      out.push({ id: f.bird.id, pos: f.det.pos, color: sp.color, dim: !active, label: `${f.bird.id} · ${sp.common} · ${fmtHeight(f.det.pos.y)}` });
    }
    return out;
  }, [all, dimRest, filtered, level, teamFilter, teamOf, speciesId, zoneId, statusF]); // eslint-disable-line react-hooks/exhaustive-deps

  const selFix = birdId ? fixes.get(birdId) ?? null : null;
  const selTree = treeId ? treeById.get(treeId) ?? null : null;

  // In the 3D and top views the map starts clean: dots appear only for what is picked
  // (a species, a team, a zone or a status), plus the bird that is open.
  const sceneShown = useMemo(() => all.filter((f) => f.det?.pos && isActive(f)).length, [all, speciesId, teamFilter, zoneId, statusF, level, teamOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const scenePoints: ScenePoint[] = useMemo(() => {
    const keep = new Set([birdId, highlightId].filter(Boolean) as string[]);
    return points.filter((p) => (filtered ? !p.dim : false) || keep.has(p.id)).map((p) => (keep.has(p.id) ? { ...p, dim: false } : p));
  }, [points, filtered, birdId, highlightId]);
  const clearPick = () => {
    setSpeciesId("");
    setTeamFilter("");
    setZoneId("");
    setStatusF("");
  };
  const activeFilters = [zoneId, level !== "all", statusF, speciesId, teamFilter].filter(Boolean).length;
  const clearFilters = () => {
    clearPick();
    setLevel("all");
  };
  const pickLabel = [
    speciesId && MONITOR_SPECIES_BY_ID[speciesId].common,
    teamFilter && MONITOR_TEAM_BY_ID[teamFilter].name,
    zoneId && MONITOR_ZONE_BY_ID[zoneId].name,
    statusF && FIX_STATUS[statusF].label,
  ].filter(Boolean).join(" · ");

  const trail = useMemo(() => {
    if (!birdId || !layers.trail || !selFix || selFix.bird.device.status === "intermittent") return null;
    return src.history(birdId, asOf - WINDOWS[win], asOf).filter((s) => s.start <= asOf).map((s) => s.pos);
  }, [birdId, layers.trail, selFix, src, asOf, win]);

  const flyTo = (pos: Vec3) => setFocus({ pos, key: Date.now() });
  /** Opens the bird card in the right panel (lists stay underneath, with their state). */
  const openBird = (id: string, fly = true) => {
    const f = fixes.get(id);
    setBirdId(id);
    setHighlightId(null);
    if (!fly) return;
    if (f?.det?.pos) flyTo(f.det.pos);
    else if (f?.det?.zoneId) flyTo(zoneCenter(f.det.zoneId));
  };
  /** Selecting a tree highlights it and shows a small card on the map; the full view opens on demand. */
  const openTree = (id: string, full = false) => {
    const t = treeById.get(id);
    setHighlightId(null);
    setTreeId(id);
    setTreeView(full);
    if (t) flyTo({ x: t.x, y: t.heightM * 0.55, z: t.z });
  };

  // The sidebar search (Ctrl K) changes ?bird= while the map is open: follow it.
  const [seenParam, setSeenParam] = useState(paramBird);
  useEffect(() => {
    if (paramBird === seenParam) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenParam(paramBird);
    if (paramBird && birdById.has(paramBird)) openBird(paramBird);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramBird]);

  const highlightZone = zoneId || (selFix?.det?.kind === "zone" ? selFix.det.zoneId : null);
  const counts = useMemo(() => {
    const c: Record<FixStatus, number> = { detected: 0, moving: 0, stale: 0, "no-signal": 0 };
    for (const f of all) c[f.status]++;
    return c;
  }, [all]);

  const birdCard = selFix && (
    <div className="space-y-2">
      <p className="px-2 text-[11px] text-muted">
        {MONITOR_TEAM_BY_ID[teamOf(selFix.bird)].name} · usual zone {MONITOR_ZONE_BY_ID[selFix.bird.homeZoneId].name}
      </p>
      <BirdCard
        fix={selFix}
        asOf={asOf}
        now={asOf}
        tab={tab}
        onTab={setTab}
        win={win}
        onWin={setWin}
        showTrail={layers.trail}
        onTrail={(v) => setLayers((l) => ({ ...l, trail: v }))}
        onClose={() => setBirdId(null)}
        onCenter={() => openBird(selFix.bird.id)}
        onTree={(id) => openTree(id, true)}
      />
    </div>
  );

  const trees = registry.trees;
  const treeIdx = selTree ? trees.findIndex((t) => t.id === selTree.id) : -1;

  return (
    <div className="space-y-3 px-4 pb-6 pt-4 lg:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Aviary · Habitat map</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">The Rainforest</h1>
            <span className="text-sm text-muted">Tropical Ocean</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5" role="group" aria-label="Map filters">
          <FilterChip label="Zone" value={zoneId} onChange={setZoneId} options={MONITOR_ZONES.map((z) => [z.id, `${z.code} · ${z.name}`] as [string, string])} />
          <FilterChip label="Level" value={level === "all" ? "" : level} onChange={(v) => setLevel((v || "all") as LevelId | "all")} options={LEVELS.map((l) => [l.id, l.label] as [string, string])} />
          <FilterChip label="Status" value={statusF} onChange={(v) => setStatusF(v as FixStatus | "")} options={STATUS_ORDER.map((s) => [s, FIX_STATUS[s].label] as [string, string])} />
          <FilterChip label="Species" value={speciesId} onChange={setSpeciesId} options={MONITOR_SPECIES.map((s) => [s.id, s.common] as [string, string])} />
          <FilterChip label="Team" value={teamFilter} onChange={(v) => setTeamFilter(v as TeamId | "")} options={MONITOR_TEAMS.map((t) => [t.id, t.name] as [string, string])} />
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-accent hover:bg-accent/10" title="Clear all filters">
              <X size={12} /> Clear ({activeFilters})
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 xl:h-[calc(100vh-128px)] xl:min-h-[660px] xl:grid-cols-[minmax(0,1fr)_330px]">

        {/* Map */}
        <section className={cx("panel flex min-h-[480px] min-w-0 flex-col overflow-hidden", maxed && "fixed inset-0 z-[55] !rounded-none !border-0")} aria-label="Aviary map">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <div className="ml-auto flex items-center gap-2">
              {maxed && (
                <button onClick={() => setClock({ playing: !clock.playing })} className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong text-muted hover:text-ink" aria-label={clock.playing ? "Pause" : "Play"}>
                  {clock.playing ? <Pause size={13} /> : <Play size={13} />}
                </button>
              )}
              {mode === "image" && (
                <Segmented size="sm" value={aggregate ? "areas" : "birds"} onChange={(v) => setAggregate(v === "areas")} options={[{ value: "areas", label: "Areas" }, { value: "birds", label: "Birds" }]} />
              )}
              <LayersMenu layers={layers} onLayers={setLayers} dimRest={dimRest} onDimRest={setDimRest} grouping={grouping} onGrouping={setGrouping} />
              <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "image", label: "Image" }, { value: "3d", label: "3D view" }, { value: "2d", label: "Top view 2D" }]} />
              <button
                onClick={() => setMaxed((v) => !v)}
                className={cx("inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium", maxed ? "border-accent bg-accent text-white" : "border-line-strong text-ink hover:border-accent/50")}
                title={maxed ? "Back to the normal layout (Esc)" : "Maximise the map"}
                aria-pressed={maxed}
              >
                {maxed ? <Minimize2 size={13} /> : <Maximize2 size={13} />} {maxed ? "Exit full map" : "Maximise"}
              </button>
            </div>
          </div>
          <div className="relative min-h-[380px] flex-1">
            {mode === "image" ? (
              <AviaryImageMap
                aggregate={aggregate}
                zoneStats={zoneStats}
                trees={trees}
                points={points}
                selectedBirdId={birdId ?? highlightId}
                selectedTreeId={treeId}
                highlightZoneId={highlightZone || null}
                precision={selFix?.det?.pos && selFix.det.precisionM ? { pos: selFix.det.pos, r: selFix.det.precisionM } : null}
                trail={trail}
                focus={focus}
                smooth={smooth}
                layers={layers}
                cluster={grouping}
                onSelectGroup={setGroupIds}
                onSelectBird={(id) => openBird(id, false)}
                onSelectTree={(id) => openTree(id)}
                onSelectZone={(z) => setZoneId((cur) => (cur === z ? "" : z))}
              />
              ) : (
              <AviaryScene
                trees={trees}
                points={scenePoints}
                selectedBirdId={birdId ?? highlightId}
                selectedTreeId={treeId}
                highlightZoneId={highlightZone || null}
                precision={selFix?.det?.pos && selFix.det.precisionM ? { pos: selFix.det.pos, r: selFix.det.precisionM } : null}
                trail={trail}
                trailColor={selFix ? MONITOR_SPECIES_BY_ID[selFix.bird.speciesId].color : undefined}
                level={level}
                mode={mode}
                focus={focus}
                dimTrees={level !== "all"}
                smooth={smooth}
                layers={layers}
                cluster={grouping}
                onSelectGroup={setGroupIds}
                onSelectBird={(id) => openBird(id, false)}
                onSelectTree={(id) => openTree(id)}
                onSelectZone={(z) => setZoneId((cur) => (cur === z ? "" : z))}
              />
              )}
            <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1 rounded-lg bg-panel-solid/85 px-2.5 py-2 text-[11px] text-muted shadow-sm backdrop-blur">
              {(["detected", "moving", "no-signal"] as FixStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  {FIX_STATUS[s].label} <span className="num ml-auto pl-2 text-ink">{counts[s]}</span>
                </span>
              ))}
              <span className="mt-0.5 text-[10px] text-faint">Dot colour = species</span>
              {grouping && <span className="text-[10px] text-faint">Numbers = grouped birds · zoom in</span>}
            </div>
            {mode !== "image" &&
              (filtered ? (
                <div className="absolute left-3 top-3 inline-flex max-w-[60%] items-center gap-2 rounded-lg border border-line-strong bg-panel-solid/95 py-1 pl-2.5 pr-1 text-xs shadow-sm backdrop-blur">
                  <span className="truncate text-ink">
                    Showing <b className="font-semibold">{pickLabel}</b> · <span className="num">{sceneShown}</span> birds
                  </span>
                  <button onClick={clearPick} className="rounded p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Clear the selection" title="Clear">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="absolute bottom-12 left-1/2 w-[min(440px,calc(100%-24px))] -translate-x-1/2 rounded-2xl border border-line-strong bg-panel-solid/95 p-3 shadow-lg backdrop-blur">
                  <p className="text-sm font-semibold text-ink">Choose which birds to show</p>
                  <p className="mt-0.5 text-[11px] text-muted">Pick a species or a team here, or click one in the lists on the right.</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <FilterSelect label="Species" value={speciesId} onChange={setSpeciesId} options={[["", "Choose…"], ...MONITOR_SPECIES.map((s) => [s.id, s.common] as [string, string])]} />
                    <FilterSelect label="Team" value={teamFilter} onChange={(v) => setTeamFilter(v as TeamId | "")} options={[["", "Choose…"], ...MONITOR_TEAMS.map((t) => [t.id, t.name] as [string, string])]} />
                  </div>
                </div>
              ))}
            {selTree && !treeView && <TreeFloat tree={selTree} fixes={fixes} onOpen={() => setTreeView(true)} onClose={() => setTreeId(null)} onBird={(id) => openBird(id)} />}
            {mode === "image" && aggregate && zoneId && (
              <ZoneCard stat={zoneStats.find((z) => z.zoneId === zoneId)!} fixes={all.filter((f) => f.det?.zoneId === zoneId && isActive(f))} onBird={(id) => openBird(id)} onClose={() => setZoneId("")} />
            )}
            {groupIds && (
              <GroupCard ids={groupIds} fixes={fixes} onBird={(id) => (setGroupIds(null), openBird(id, false))} onClose={() => setGroupIds(null)} />
            )}
            {maxed && selFix && (
              <div className="scroll-thin absolute right-3 top-28 max-h-[calc(100%-8rem)] w-[340px] overflow-y-auto rounded-2xl">{birdCard}</div>
            )}
          </div>
        </section>

        {/* Right column: species legend on top, monitoring teams below; a bird card opens over both. */}
        <div className={cx("flex min-h-0 flex-col gap-3", maxed && "hidden")}>
          {selFix && !maxed && (
            <aside className="panel scroll-thin min-h-0 flex-1 overflow-y-auto p-3" aria-label="Bird card">
              <button onClick={() => setBirdId(null)} className="mb-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10">
                <ArrowLeft size={14} /> Back to species and teams
              </button>
              {birdCard}
            </aside>
          )}
          {/* Kept mounted while a card is open, so scroll and open sections are still there on the way back. */}
          <aside className={cx("panel h-[410px] shrink-0 flex-col overflow-hidden", selFix && !maxed ? "hidden" : "flex")} aria-label="Species">
            <SpeciesSection fixes={all} speciesFilter={speciesId} onSpeciesFilter={setSpeciesId} onBird={openBird} selectedBird={birdId} />
          </aside>
          <aside className={cx("panel min-h-[230px] flex-1 flex-col overflow-hidden", selFix && !maxed ? "hidden" : "flex")} aria-label="Monitoring teams">
            <TeamsSection fixes={all} teamOf={teamOf} onAssign={assign} teamFilter={teamFilter} onTeamFilter={setTeamFilter} onBird={openBird} />
          </aside>
        </div>
      </div>

      {selTree && treeView && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setTreeView(false)} />
          <aside className="slide-in relative flex h-full w-[min(440px,100vw)] flex-col border-l border-line bg-panel-solid shadow-2xl" aria-label={`Tree ${selTree.id}`}>
            <TreePanel
              key={selTree.id}
              tree={selTree}
              fixes={fixes}
              asOf={asOf}
              ds={ds}
              src={src}
              highlightId={highlightId}
              onHighlight={setHighlightId}
              onOpenBird={(id) => (setTreeView(false), openBird(id, false))}
              onClose={() => (setTreeView(false), setHighlightId(null))}
              onPrev={() => openTree(trees[(treeIdx - 1 + trees.length) % trees.length].id, true)}
              onNext={() => openTree(trees[(treeIdx + 1) % trees.length].id, true)}
            />
          </aside>
        </div>
      )}

      {!maxed && <BottomRow fixes={all} ds={ds} src={src} asOf={asOf} level={level} onLevel={setLevel} counts={counts} />}
    </div>
  );
}

/* ---------- right: tree ---------- */

function TreePanel({ tree, fixes, asOf, ds, src, highlightId, onHighlight, onOpenBird, onClose, onPrev, onNext }: {
  tree: AviaryTree;
  fixes: Map<string, Fix>;
  asOf: number;
  ds: TrackingState["ds"];
  src: TrackingState["src"];
  highlightId: string | null;
  onHighlight: (id: string | null) => void;
  onOpenBird: (id: string) => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [tab, setTab] = useState<"birds" | "info" | "history">("birds");
  const [speciesPick, setSpeciesPick] = useState<string | null>(null);
  const occ = treeOccupants(fixes, tree.id);
  const birds: TreeBird[] = occ.map((f) => ({
    id: f.bird.id,
    species: MONITOR_SPECIES_BY_ID[f.bird.speciesId].code,
    heightM: f.det!.pos!.y,
    precisionM: f.det!.precisionM ?? 1,
    dx: f.det!.pos!.x - tree.x,
    status: f.status,
    ring: MONITOR_SPECIES_BY_ID[f.bird.speciesId].color,
  }));
  const bySpecies = (() => {
    const m = new Map<string, number>();
    for (const f of occ) m.set(f.bird.speciesId, (m.get(f.bird.speciesId) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  })();
  const rows = speciesPick ? occ.filter((f) => f.bird.speciesId === speciesPick) : occ;
  const shown = speciesPick ? birds.filter((b) => b.species === MONITOR_SPECIES_BY_ID[speciesPick].code) : birds;
  const hist = tab === "history" ? treeHistory(ds, src, tree.id, asOf - 24 * HOUR, asOf) : [];
  const zone = MONITOR_ZONE_BY_ID[tree.zoneId];
  const speciesOf = (birdId: string) => MONITOR_SPECIES_BY_ID[ds.registry.birds.find((b) => b.id === birdId)!.speciesId];

  return (
    <div className="slide-in flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-1 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            {tree.id}
            {tree.plantSpecies && <span> — {tree.plantSpecies}</span>}
          </h2>
          <p className="text-[11px] text-muted">
            {tree.form[0].toUpperCase() + tree.form.slice(1)} · {tree.heightM.toFixed(1)} m · {zone.code} {zone.name}
          </p>
        </div>
        <button onClick={onPrev} className="rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Previous tree"><ChevronLeft size={16} /></button>
        <button onClick={onNext} className="rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Next tree"><ChevronRight size={16} /></button>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close tree"><X size={16} /></button>
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="px-2 pt-2">
          <TreeIllustration tree={tree} birds={shown} highlightId={highlightId} onHover={onHighlight} onOpen={onOpenBird} />
          <p className="px-2 text-[10px] leading-snug text-faint">
            Each dot is a bird, in its species colour, at its estimated height and offset from the trunk (bar = ± uncertainty); nearby birds overlap. Trunk, branches and crown are schematic, levels provisional, and no branch is assigned.
          </p>
        </div>

        {bySpecies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3">
            {bySpecies.map(([sid, n]) => {
              const sp = MONITOR_SPECIES_BY_ID[sid];
              const on = speciesPick === sid;
              return (
                <button
                  key={sid}
                  onClick={() => setSpeciesPick(on ? null : sid)}
                  className={cx("inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-[11px]", on ? "border-accent/60 bg-accent/12 text-ink" : "border-line-strong text-muted hover:text-ink")}
                  title={`Show only ${sp.common}`}
                >
                  <SpeciesAvatar code={sp.code} size={22} ring={sp.color} />
                  <span className="max-w-[110px] truncate">{sp.common}</span>
                  <span className="num font-semibold text-ink">×{n}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex border-b border-line px-3 text-xs" role="tablist">
          {(
            [
              ["birds", `Birds in this tree (${occ.length})`],
              ["info", "Information"],
              ["history", "History"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx("-mb-px border-b-2 px-2.5 py-2 font-medium", tab === k ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>

        {tab === "birds" &&
          (rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted">No bird is located in this tree right now. Zone-level detections are never assigned to a tree.</p>
          ) : (
            <>
              <table className="w-full text-xs">
                <caption className="sr-only">Birds located in tree {tree.id}</caption>
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-faint">
                    <th scope="col" className="py-1.5 pl-4 font-medium">ID</th>
                    <th scope="col" className="py-1.5 font-medium">Species</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Height</th>
                    <th scope="col" className="py-1.5 text-center font-medium">Level</th>
                    <th scope="col" className="py-1.5 pr-4 text-right font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((f) => {
                    const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
                    const h = f.det!.pos!.y;
                    const on = highlightId === f.bird.id;
                    return (
                      <tr
                        key={f.bird.id}
                        onClick={() => onHighlight(on ? null : f.bird.id)}
                        onDoubleClick={() => onOpenBird(f.bird.id)}
                        className={cx("cursor-pointer border-t border-line/60 transition-colors", on ? "bg-accent/12" : "hover:bg-ink/[0.03]")}
                        aria-selected={on}
                      >
                        <td className="py-1.5 pl-4">
                          <span className="flex items-center gap-2">
                            <SpeciesAvatar code={sp.code} size={24} ring={sp.color} />
                            <span className="font-mono font-semibold text-ink">{f.bird.id}</span>
                          </span>
                        </td>
                        <td className="max-w-[110px] truncate py-1.5 text-muted">{sp.common}</td>
                        <td className="num py-1.5 text-right text-ink">{h.toFixed(1)} m</td>
                        <td className="py-1.5 text-center text-muted">{LEVEL_SHORT[levelOf(h).id]}</td>
                        <td className="py-1.5 pr-4 text-right">
                          <span className="text-muted">{fmtTime(f.det!.at)}</span>
                          <button onClick={(e) => (e.stopPropagation(), onOpenBird(f.bird.id))} className="ml-1.5 rounded px-1 text-accent hover:bg-accent/10" aria-label={`Open ${f.bird.id}`}>
                            →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-4 py-2 text-[10px] text-faint">Click a row to highlight the bird on the tree and the map; → or double-click opens its card.</p>
            </>
          ))}

        {tab === "info" && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3 text-xs">
            <Info k="Tree" v={`${tree.id}${tree.plantSpecies ? ` · ${tree.plantSpecies}` : ""}`} />
            <Info k="Plant name" v={tree.plantSpecies ?? <span className="text-muted">Not set</span>} />
            <Info k="Form" v={tree.form[0].toUpperCase() + tree.form.slice(1)} />
            <Info k="Total height" v={`${tree.heightM.toFixed(1)} m`} />
            <Info k="Crown radius" v={`${tree.crownRadiusM.toFixed(1)} m`} />
            <Info k="Coordinates" v={`X ${tree.x.toFixed(1)} · Y ${tree.z.toFixed(1)} m`} />
            <Info k="Levels" v={LEVELS.filter((l) => l.id !== "ground" && l.min < tree.heightM).map((l) => l.short).join(", ")} />
            <Info k="Reference points" v={tree.branchTiersM.map((h, i) => `R${i + 1} ${h.toFixed(1)} m`).join(" · ")} />
            <Info k="Birds now" v={String(occ.length)} />
            <Info k="Species now" v={String(bySpecies.length)} />
          </dl>
        )}

        {tab === "history" && (
          <div className="px-3 py-2">
            <p className="px-1 pb-1.5 text-[11px] text-muted">Stays in this tree, last 24 hours ({hist.length})</p>
            <ul className="space-y-0.5">
              {hist.slice(0, 80).map((r) => (
                <li key={r.id}>
                  <button onClick={() => onOpenBird(r.birdId)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-ink/[0.04]">
                    <SpeciesAvatar code={speciesOf(r.birdId).code} size={20} />
                    <span className="font-mono text-ink">{r.birdId}</span>
                    <span className="num ml-auto text-muted">
                      {fmtTime(r.start)}–{fmtTime(Math.min(r.end, asOf))}
                    </span>
                    <span className="num w-12 text-right text-ink">{r.heightM.toFixed(1)} m</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-faint">{k}</dt>
      <dd className="mt-0.5 text-ink">{v}</dd>
    </div>
  );
}

/* ---------- controls ---------- */

/** A small filter pill: shows its value, and is tinted while it filters. */
function FilterChip({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const on = !!value;
  const current = options.find(([v]) => v === value)?.[1];
  return (
    <label
      className={cx(
        "relative inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border pl-2.5 pr-6 text-[11px] transition",
        on ? "border-accent/60 bg-accent/10 text-ink" : "border-line-strong bg-panel-solid text-muted hover:border-ink/25 hover:text-ink",
      )}
      title={on ? `${label}: ${current}` : `Filter by ${label.toLowerCase()}`}
    >
      <span className={cx(on && "text-accent")}>{label}</span>
      {on && <span className="max-w-[110px] truncate font-medium">: {current}</span>}
      <ChevronDown size={12} className="pointer-events-none absolute right-2 text-faint" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label}>
        <option value="">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex min-w-[118px] flex-col rounded-lg border border-line-strong bg-panel-2 px-2 py-1">
      <span className="text-[9px] uppercase tracking-wider text-faint">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[150px] bg-transparent text-xs text-ink outline-none">
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-panel-solid">
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function LayersMenu({ layers, onLayers, dimRest, onDimRest, grouping, onGrouping }: {
  layers: Layers3D;
  onLayers: (l: Layers3D) => void;
  dimRest: boolean;
  onDimRest: (v: boolean) => void;
  grouping: boolean;
  onGrouping: (v: boolean) => void;
}) {
  const items: [keyof Layers3D, string][] = [
    ["zones", "Habitat zones"],
    ["labels", "Zone and tree labels"],
    ["dome", "Enclosure dome"],
    ["trail", "Selected bird's path"],
  ];
  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-xs text-muted hover:text-ink">
        <Layers size={13} /> Layers
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-60 space-y-1.5 rounded-xl border border-line-strong bg-panel-solid p-3 shadow-lg">
        {items.map(([k, label]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 text-xs text-muted hover:text-ink">
            <input type="checkbox" checked={layers[k]} onChange={() => onLayers({ ...layers, [k]: !layers[k] })} className="accent-[var(--accent)]" />
            {label}
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted hover:text-ink">
          <input type="checkbox" checked={dimRest} onChange={() => onDimRest(!dimRest)} className="accent-[var(--accent)]" />
          Dim birds outside the filters
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted hover:text-ink">
          <input type="checkbox" checked={grouping} onChange={() => onGrouping(!grouping)} className="accent-[var(--accent)]" />
          Group nearby birds
        </label>
      </div>
    </details>
  );
}


/* ---------- bottom ---------- */

function BottomRow({ fixes, ds, src, asOf, level, onLevel, counts }: {
  fixes: Fix[];
  ds: TrackingState["ds"];
  src: TrackingState["src"];
  asOf: number;
  level: LevelId | "all";
  onLevel: (l: LevelId | "all") => void;
  counts: Record<FixStatus, number>;
}) {
  const total = fixes.length;
  const species = useMemo(() => {
    const rows = MONITOR_SPECIES.map((s) => ({ s, n: fixes.filter((f) => f.bird.speciesId === s.id).length })).sort((a, b) => b.n - a.n);
    return { top: rows.slice(0, 6), other: rows.slice(6).reduce((a, r) => a + r.n, 0) };
  }, [fixes]);
  const withH = fixes.filter((f) => f.levelId);
  const byLevel = LEVELS.map((l) => ({ l, n: withH.filter((f) => f.levelId === l.id).length }));
  const maxL = Math.max(1, ...byLevel.map((b) => b.n));
  // Recomputed every 5 simulated minutes, not on every clock tick.
  const bucket = Math.floor(asOf / (5 * MIN)) * 5 * MIN;
  const activity = useMemo(() => activityByHour(ds, src, bucket), [ds, src, bucket]);
  const pct = (n: number) => `${total ? Math.round((n / total) * 100) : 0}%`;

  return (
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-[1.1fr_1fr_1.3fr]">
      <section className="panel p-4">
        <h2 className="text-sm font-semibold text-ink">Birds by species</h2>
        <div className="mt-3 flex items-center gap-4">
          <Donut
            size={128}
            parts={[...species.top.map(({ s, n }) => ({ value: n, color: s.color, label: s.common })), { value: species.other, color: "#5b6f82", label: "Other species" }]}
            center={
              <span>
                <span className="num block text-xl font-semibold text-ink">{total}</span>
                <span className="text-[10px] text-muted">birds</span>
              </span>
            }
          />
          <ul className="min-w-0 flex-1 space-y-1 text-xs">
            {species.top.map(({ s, n }) => (
              <li key={s.id} className="flex items-center gap-2">
                <SpeciesAvatar code={s.code} size={20} />
                <span className="truncate text-muted">{s.common}</span>
                <span className="num ml-auto font-semibold text-ink">{n}</span>
                <span className="num w-9 text-right text-faint">{pct(n)}</span>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-ink/10 text-[9px] text-muted">+{MONITOR_SPECIES.length - 6}</span>
              <span className="text-muted">Other species</span>
              <span className="num ml-auto font-semibold text-ink">{species.other}</span>
              <span className="num w-9 text-right text-faint">{pct(species.other)}</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-sm font-semibold text-ink">Birds by height level</h2>
        <ul className="mt-3 space-y-2">
          {byLevel.map(({ l, n }) => (
            <li key={l.id}>
              <button
                onClick={() => onLevel(level === l.id ? "all" : l.id)}
                className={cx("grid w-full grid-cols-[96px_1fr_64px] items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs", level === l.id ? "bg-accent/12" : "hover:bg-ink/[0.04]")}
              >
                <span className="text-muted">
                  <span className="block text-ink">{l.short}</span>
                  <span className="text-[10px]">{l.id === "ground" ? "0 m" : l.max === Infinity ? `> ${l.min} m` : `${l.min === 0.5 ? 0 : l.min}–${l.max} m`}</span>
                </span>
                <span className="h-3 overflow-hidden rounded bg-ink/[0.06]">
                  <span className="block h-full rounded" style={{ width: `${(n / maxL) * 100}%`, background: l.color }} />
                </span>
                <span className="num text-right">
                  <span className="font-semibold text-ink">{n}</span> <span className="text-faint">{withH.length ? Math.round((n / withH.length) * 100) : 0}%</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] text-faint">{total - withH.length} birds without a height (zone-level signal or no location). Ranges are provisional.</p>
      </section>

      <section className="panel p-4 lg:col-span-2 2xl:col-span-1">
        <h2 className="text-sm font-semibold text-ink">Aviary activity</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["detected", "moving", "no-signal"] as FixStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full" style={{ boxShadow: `inset 0 0 0 3px ${FIX_STATUS[s].color}` }} />
              <span>
                <span className="num block text-lg font-semibold leading-none text-ink">{counts[s]}</span>
                <span className="text-[10px] text-muted">
                  {FIX_STATUS[s].label} · {pct(counts[s])}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <LineChart
            height={110}
            format={(v) => String(Math.round(v))}
            data={activity.map((b) => ({ label: fmtTime(b.at), values: { detected: b.detected, moving: b.moving } }))}
            series={[
              { key: "detected", color: FIX_STATUS.detected.color, label: "Birds detected", area: true },
              { key: "moving", color: FIX_STATUS.moving.color, label: "Birds that moved" },
            ]}
          />
          <p className="text-[10px] text-faint">Last 24 hours, whole aviary.</p>
        </div>
      </section>
    </div>
  );
}

/** Compact, closable card for the selected tree; the vertical view opens from it. */
function TreeFloat({ tree, fixes, onOpen, onClose, onBird }: { tree: AviaryTree; fixes: Map<string, Fix>; onOpen: () => void; onClose: () => void; onBird: (id: string) => void }) {
  const occ = treeOccupants(fixes, tree.id);
  const byLevel = LEVELS.filter((l) => l.id === "ground" || l.min < tree.heightM).map((l) => ({ l, n: occ.filter((f) => f.levelId === l.id).length }));
  const last = occ.reduce((m, f) => Math.max(m, f.det!.at), 0);
  return (
    <div className="absolute bottom-3 left-3 w-[300px] rounded-xl border border-line-strong bg-panel-solid/95 p-3 shadow-lg backdrop-blur">
      <button onClick={onClose} className="absolute right-2 top-2 rounded-md p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
        <X size={14} />
      </button>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <TreePine size={15} className="text-accent" /> {tree.id}
        {tree.plantSpecies && <span>— {tree.plantSpecies}</span>}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">
        {tree.heightM.toFixed(1)} m · {MONITOR_ZONE_BY_ID[tree.zoneId].name} · {occ.length} birds{last ? ` · last ${fmtTime(last)}` : ""}
      </p>
      <div className="mt-2 flex gap-1">
        {byLevel.reverse().map(({ l, n }) => (
          <span key={l.id} className="flex-1 rounded-md bg-ink/[0.04] px-1 py-0.5 text-center" title={l.label}>
            <span className="block text-[9px] text-faint">{LEVEL_SHORT[l.id]}</span>
            <span className="num text-xs font-semibold text-ink">{n}</span>
          </span>
        ))}
      </div>
      <ul className="scroll-thin mt-2 max-h-32 overflow-y-auto">
        {occ.map((f) => {
          const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
          return (
            <li key={f.bird.id}>
              <button onClick={() => onBird(f.bird.id)} className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-ink/[0.04]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white" style={{ background: sp.color }} />
                <span className="font-mono text-[11px] font-semibold text-ink">{f.bird.id}</span>
                <span className="truncate text-[10px] text-muted">{sp.common}</span>
                <span className="num ml-auto text-[10px] text-ink">{f.det!.pos!.y.toFixed(1)} m</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button onClick={onOpen} className="mt-2 inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-semibold text-white">
        Vertical tree view
      </button>
    </div>
  );
}

/** Birds that stay together at the closest zoom: they share an estimated spot, so they are listed, not spread out. */
function GroupCard({ ids, fixes, onBird, onClose }: { ids: string[]; fixes: Map<string, Fix>; onBird: (id: string) => void; onClose: () => void }) {
  return (
    <div className="absolute left-3 top-3 w-[270px] rounded-xl border border-line-strong bg-panel-solid/95 p-3 shadow-lg backdrop-blur">
      <button onClick={onClose} className="absolute right-2 top-2 rounded-md p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
        <X size={14} />
      </button>
      <p className="text-sm font-semibold text-ink">{ids.length} birds at about the same spot</p>
      <p className="mt-0.5 text-[11px] text-muted">Their estimated positions overlap; they are listed instead of being spread out.</p>
      <ul className="scroll-thin mt-2 max-h-48 overflow-y-auto">
        {ids.map((id) => {
          const f = fixes.get(id);
          if (!f) return null;
          const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
          return (
            <li key={id}>
              <button onClick={() => onBird(id)} className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-ink/[0.04]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white" style={{ background: sp.color }} />
                <span className="font-mono text-[11px] font-semibold text-ink">{id}</span>
                <span className="truncate text-[10px] text-muted">{sp.common}</span>
                <span className="num ml-auto text-[10px] text-ink">{f.det?.pos ? `${f.det.pos.y.toFixed(1)} m` : "—"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Who is in the chosen area: totals, species mix and the birds themselves. */
function ZoneCard({ stat, fixes, onBird, onClose }: { stat: ZoneStat; fixes: Fix[]; onBird: (id: string) => void; onClose: () => void }) {
  const zone = MONITOR_ZONE_BY_ID[stat.zoneId];
  // Open on the side away from the area, so the card does not cover its birds.
  const east = zone.sector ? Math.cos((((zone.sector[0] + zone.sector[1]) / 2) * Math.PI) / 180) > 0.1 : false;
  const total = Math.max(1, stat.count);
  return (
    <div className={cx("absolute bottom-3 flex max-h-[calc(100%-8.5rem)] w-[300px] flex-col rounded-xl border border-line-strong bg-panel-solid/95 p-3 shadow-lg backdrop-blur", east ? "left-3" : "right-14")}>
      <button onClick={onClose} className="absolute right-2 top-2 rounded-md p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close area">
        <X size={14} />
      </button>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <span className="h-3 w-1 rounded-full" style={{ background: zone.color }} /> {zone.code} · {zone.name}
      </p>
      <p className="num mt-0.5 text-[11px] text-muted">
        {stat.count} birds · {stat.species.length} species · {stat.detected} detected · {stat.noSignal} no signal
      </p>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-ink/[0.05]" title="Species mix">
        {stat.species.map((s) => (
          <span key={s.name} style={{ width: `${(s.n / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
        {stat.species.slice(0, 6).map((s) => (
          <li key={s.name} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name} <span className="num text-ink">{s.n}</span>
          </li>
        ))}
        {stat.species.length > 6 && <li>+{stat.species.length - 6} more</li>}
      </ul>
      <ul className="scroll-thin mt-2 min-h-0 flex-1 overflow-y-auto border-t border-line pt-1">
        {fixes.map((f) => {
          const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
          return (
            <li key={f.bird.id}>
              <button onClick={() => onBird(f.bird.id)} className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-ink/[0.04]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white" style={{ background: sp.color }} />
                <span className="font-mono text-[11px] font-semibold text-ink">{f.bird.id}</span>
                <span className="truncate text-[10px] text-muted">{sp.common}</span>
                <span className="num ml-auto text-[10px] text-ink">{f.det?.treeId ?? "—"}{f.det?.pos ? ` · ${f.det.pos.y.toFixed(1)} m` : ""}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
