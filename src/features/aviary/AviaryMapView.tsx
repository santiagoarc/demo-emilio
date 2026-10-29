"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Layers, Pause, Play, RotateCcw, Search, TreePine, X } from "lucide-react";
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
import { STRUCTURES } from "@/data/aviaryTrackingSimulate";
import { activityByHour, fmtHeight, snapshot, treeHistory, treeOccupants, type Fix } from "@/logic/aviaryTracking";
import { HOUR, MIN, fmtDateTime, fmtTime } from "@/logic/time";
import { useSimClock, useTracking, type TrackingState } from "@/state/useTracking";
import { Chip, Segmented, cx } from "@/components/ui/primitives";
import { Donut, LineChart } from "@/components/charts/Charts";
import { DEFAULT_SCENE_LAYERS, type SceneLayers, type ScenePoint } from "./monitor/AviaryScene";
import { AviaryScene, BirdCard, GROUPS, SPEEDS, STATUS_ORDER, WINDOWS, type GroupFilter, type WindowId } from "./monitor/AviaryParts";
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
  const { clock, set: setClock, restart } = useSimClock(registry, ds.horizon);
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

  const [group, setGroup] = useState<GroupFilter>("all");
  const [speciesId, setSpeciesId] = useState(() => {
    const s = params.get("species");
    return s && MONITOR_SPECIES_BY_ID[s] ? s : "";
  });
  const [zoneId, setZoneId] = useState("");
  const [level, setLevel] = useState<LevelId | "all">("all");
  const [statusF, setStatusF] = useState<FixStatus | "">("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [layers, setLayers] = useState<Layers3D>({ ...DEFAULT_SCENE_LAYERS, trail: true });
  const [dimRest, setDimRest] = useState(true);
  const [smooth, setSmooth] = useState(true);
  const [tab, setTab] = useState<"info" | "location" | "history">("location");
  const [win, setWin] = useState<WindowId>("6h");

  const matches = (f: Fix) => {
    const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
    if (group !== "all" && sp.group !== group) return false;
    if (speciesId && f.bird.speciesId !== speciesId) return false;
    if (zoneId && f.det?.zoneId !== zoneId) return false;
    if (statusF && f.status !== statusF) return false;
    return true;
  };
  const isActive = (f: Fix) => matches(f) && (level === "all" || f.levelId === level);
  const filtered = group !== "all" || !!speciesId || !!zoneId || !!statusF;

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
  }, [all, dimRest, filtered, level, group, speciesId, zoneId, statusF]); // eslint-disable-line react-hooks/exhaustive-deps

  const selFix = birdId ? fixes.get(birdId) ?? null : null;
  const selTree = treeId ? treeById.get(treeId) ?? null : null;

  const trail = useMemo(() => {
    if (!birdId || !layers.trail || !selFix || selFix.bird.device.status === "intermittent") return null;
    return src.history(birdId, asOf - WINDOWS[win], asOf).filter((s) => s.start <= asOf).map((s) => s.pos);
  }, [birdId, layers.trail, selFix, src, asOf, win]);

  const flyTo = (pos: Vec3) => setFocus({ pos, key: Date.now() });
  /** Opens the bird card; the tree it is in stays as the context to come back to. */
  const openBird = (id: string, fly = true) => {
    const f = fixes.get(id);
    setBirdId(id);
    setHighlightId(null);
    if (f?.det?.treeId) setTreeId(f.det.treeId);
    if (!fly) return;
    if (f?.det?.pos) flyTo(f.det.pos);
    else if (f?.det?.zoneId) flyTo(zoneCenter(f.det.zoneId));
  };
  const openTree = (id: string) => {
    const t = treeById.get(id);
    setBirdId(null);
    setHighlightId(null);
    setTreeId(id);
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
            <span className="rounded-md bg-warn px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">DEMO / SIMULATED DATA</span>
          </div>
        </div>
        <ClockBar clock={clock} onClock={setClock} onRestart={restart} start={ds.windowStart} end={ds.horizon} anchor={registry.anchor} smooth={smooth} onSmooth={setSmooth} />
      </div>

      <div className="grid gap-3 xl:h-[calc(100vh-128px)] xl:min-h-[640px] xl:grid-cols-[280px_minmax(0,1fr)_400px]">
        <SpeciesPanel fixes={all} group={group} onGroup={setGroup} speciesId={speciesId} onSpecies={setSpeciesId} query={query} onQuery={setQuery} onBird={openBird} selectedBird={birdId} />

        {/* Map */}
        <section className="panel flex min-h-[480px] min-w-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <FilterSelect label="Zone" value={zoneId} onChange={setZoneId} options={[["", "All zones"], ...MONITOR_ZONES.map((z) => [z.id, `${z.code} · ${z.name}`] as [string, string])]} />
            <FilterSelect label="Height level" value={level === "all" ? "" : level} onChange={(v) => setLevel((v || "all") as LevelId | "all")} options={[["", "All levels"], ...LEVELS.map((l) => [l.id, l.label] as [string, string])]} />
            <FilterSelect label="Status" value={statusF} onChange={(v) => setStatusF(v as FixStatus | "")} options={[["", "All"], ...STATUS_ORDER.map((s) => [s, FIX_STATUS[s].label] as [string, string])]} />
            <FilterSelect label="Species" value={speciesId} onChange={setSpeciesId} options={[["", "All"], ...MONITOR_SPECIES.map((s) => [s.id, s.common] as [string, string])]} />
            <div className="ml-auto flex items-center gap-2">
              <LayersMenu layers={layers} onLayers={setLayers} dimRest={dimRest} onDimRest={setDimRest} />
              <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "2d", label: "2D view" }, { value: "3d", label: "3D view" }]} />
            </div>
          </div>
          <div className="relative min-h-[380px] flex-1">
            <AviaryScene
              trees={trees}
              structures={STRUCTURES}
              points={points}
              selectedBirdId={birdId ?? highlightId}
              selectedTreeId={treeId}
              highlightZoneId={highlightZone || null}
              precision={selFix?.det?.pos && selFix.det.precisionM ? { pos: selFix.det.pos, r: selFix.det.precisionM } : null}
              trail={trail}
              level={level}
              mode={mode}
              focus={focus}
              dimTrees={level !== "all"}
              smooth={smooth}
              layers={layers}
              onSelectBird={(id) => openBird(id, false)}
              onSelectTree={openTree}
              onSelectZone={(z) => setZoneId((cur) => (cur === z ? "" : z))}
            />
            <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1 rounded-lg bg-panel-solid/85 px-2.5 py-2 text-[11px] text-muted shadow-sm backdrop-blur">
              {(["detected", "moving", "no-signal"] as FixStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  {FIX_STATUS[s].label} <span className="num ml-auto pl-2 text-ink">{counts[s]}</span>
                </span>
              ))}
              <span className="mt-0.5 text-[10px] text-faint">Dot colour = species</span>
            </div>
          </div>
        </section>

        {/* Selected tree / bird */}
        <aside className="panel flex min-h-[480px] flex-col overflow-hidden" aria-label="Selection">
          {selFix ? (
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
              {selTree && (
                <button onClick={() => setBirdId(null)} className="mb-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10">
                  <ArrowLeft size={14} /> Back to tree {selTree.id}
                  {selTree.plantSpecies ? ` · ${selTree.plantSpecies}` : ""}
                </button>
              )}
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
                onTree={openTree}
              />
            </div>
          ) : selTree ? (
            <TreePanel
              key={selTree.id}
              tree={selTree}
              fixes={fixes}
              asOf={asOf}
              ds={ds}
              src={src}
              highlightId={highlightId}
              onHighlight={setHighlightId}
              onOpenBird={(id) => openBird(id, false)}
              onClose={() => (setTreeId(null), setHighlightId(null))}
              onPrev={() => openTree(trees[(treeIdx - 1 + trees.length) % trees.length].id)}
              onNext={() => openTree(trees[(treeIdx + 1) % trees.length].id)}
            />
          ) : (
            <TreeIndex trees={trees} fixes={fixes} onOpen={openTree} />
          )}
        </aside>
      </div>

      <BottomRow fixes={all} ds={ds} src={src} asOf={asOf} level={level} onLevel={setLevel} counts={counts} />
    </div>
  );
}

/* ---------- left: species with images ---------- */

function SpeciesPanel({ fixes, group, onGroup, speciesId, onSpecies, query, onQuery, onBird, selectedBird }: {
  fixes: Fix[];
  group: GroupFilter;
  onGroup: (g: GroupFilter) => void;
  speciesId: string;
  onSpecies: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  onBird: (id: string) => void;
  selectedBird: string | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const bySpecies = useMemo(() => {
    const m = new Map<string, Fix[]>();
    for (const f of fixes) {
      const list = m.get(f.bird.speciesId);
      if (list) list.push(f);
      else m.set(f.bird.speciesId, [f]);
    }
    return m;
  }, [fixes]);
  const list = MONITOR_SPECIES.filter((s) => (group === "all" || s.group === group) && (!q || `${s.common} ${s.commonEs} ${s.scientific} ${s.code}`.toLowerCase().includes(q)));
  const idHits = q.length >= 2 ? fixes.filter((f) => f.bird.id.toLowerCase().includes(q) || (f.bird.name ?? "").toLowerCase().includes(q)).slice(0, 12) : [];

  return (
    <aside className="panel flex min-h-[420px] flex-col overflow-hidden" aria-label="Species">
      <div className="border-b border-line p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-ink">Species</h2>
          {speciesId && (
            <button onClick={() => onSpecies("")} className="text-[11px] text-accent hover:underline">
              Show all
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted">
          {MONITOR_SPECIES.length} species · {fixes.length} individuals
        </p>
        <label className="relative mt-2.5 block">
          <span className="sr-only">Search species or bird ID</span>
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search species or ID…"
            className="h-9 w-full rounded-xl border border-line-strong bg-panel-2 pl-8 pr-7 text-xs text-ink outline-none placeholder:text-faint focus:border-accent/60"
          />
          {query && (
            <button onClick={() => onQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink" aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </label>
        <div className="mt-2 flex flex-wrap gap-1">
          {GROUPS.map((g) => (
            <Chip key={g.id} active={group === g.id} onClick={() => onGroup(g.id)} className="!h-6 !px-2 !text-[11px]">
              {g.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">
        {idHits.length > 0 && (
          <div className="mb-2">
            <p className="eyebrow px-2 py-1">Individuals</p>
            {idHits.map((f) => (
              <BirdRow key={f.bird.id} fix={f} on={selectedBird === f.bird.id} onClick={() => onBird(f.bird.id)} />
            ))}
          </div>
        )}
        {list.map((s) => {
          const birds = bySpecies.get(s.id) ?? [];
          const live = birds.filter((f) => f.status === "detected" || f.status === "moving").length;
          const expanded = open === s.id;
          return (
            <div key={s.id}>
              <div className={cx("flex items-center gap-2 rounded-lg px-2 py-1.5", speciesId === s.id ? "bg-accent/12" : "hover:bg-ink/[0.04]")}>
                <button onClick={() => onSpecies(speciesId === s.id ? "" : s.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" title={`Show only ${s.common} on the map`}>
                  <SpeciesAvatar code={s.code} size={38} ring={s.color} title={`Map colour of ${s.common}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{s.common}</span>
                    <span className="block truncate text-[11px] italic text-muted">{s.scientific}</span>
                  </span>
                  <span className="text-right">
                    <span className="num block text-[13px] font-semibold text-ink">{birds.length}</span>
                    <span className="num flex items-center justify-end gap-1 text-[10px] text-muted" title="Detected or moving now">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: FIX_STATUS.detected.color }} />
                      {live}
                    </span>
                  </span>
                </button>
                <button onClick={() => setOpen(expanded ? null : s.id)} className="rounded p-0.5 text-faint hover:text-ink" aria-expanded={expanded} aria-label={`Individuals of ${s.common}`}>
                  <ChevronDown size={15} className={cx("transition", expanded && "rotate-180")} />
                </button>
              </div>
              {expanded && (
                <div className="mb-1 ml-6 border-l border-line pl-2">
                  {birds.map((f) => (
                    <BirdRow key={f.bird.id} fix={f} on={selectedBird === f.bird.id} onClick={() => onBird(f.bird.id)} compact />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="border-t border-line px-3 py-2 text-[10px] text-faint">Demo catalogue · counts are fictional. Photos: Wikimedia Commons.</p>
    </aside>
  );
}

function BirdRow({ fix, on, onClick, compact }: { fix: Fix; on: boolean; onClick: () => void; compact?: boolean }) {
  const sp = MONITOR_SPECIES_BY_ID[fix.bird.speciesId];
  const d = fix.det;
  return (
    <button onClick={onClick} className={cx("flex w-full items-center gap-2 rounded-md px-2 py-1 text-left", on ? "bg-accent/15" : "hover:bg-ink/[0.04]")}>
      {compact ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: FIX_STATUS[fix.status].color }} /> : <SpeciesAvatar code={sp.code} size={22} ring={sp.color} />}
      <span className="font-mono text-[11px] font-semibold text-ink">{fix.bird.id}</span>
      <span className="ml-auto truncate text-[10px] text-muted">
        {d?.treeId ?? (d?.zoneId ? MONITOR_ZONE_BY_ID[d.zoneId].code : "—")}
        {d?.pos ? ` · ${d.pos.y.toFixed(1)} m` : ""}
      </span>
    </button>
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
            {tree.form[0].toUpperCase() + tree.form.slice(1)} · {tree.heightM.toFixed(1)} m · {zone.code} {zone.name} · <span className="text-warn">demo tree</span>
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
            Each image is a bird at its estimated height and offset from the trunk (bar = ± uncertainty); nearby birds overlap. Trunk, branches and crown are schematic, levels provisional, and no branch is assigned.
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
            <Info k="Plant name" v={<span className="text-warn">Illustrative demo name</span>} />
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
            <p className="px-1 pb-1.5 text-[11px] text-muted">Stays in this tree, last 24 simulated hours ({hist.length})</p>
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

/** Default right panel: the trees with most birds, as a way in. */
function TreeIndex({ trees, fixes, onOpen }: { trees: AviaryTree[]; fixes: Map<string, Fix>; onOpen: (id: string) => void }) {
  const ranked = useMemo(
    () =>
      trees
        .map((t) => ({ t, occ: treeOccupants(fixes, t.id) }))
        .sort((a, b) => b.occ.length - a.occ.length)
        .slice(0, 14),
    [trees, fixes],
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <TreePine size={16} className="text-accent" /> Select a tree
        </h2>
        <p className="mt-1 text-xs text-muted">Click a tree on the map, or pick one here, to see its structure and the birds in it.</p>
      </div>
      <ul className="scroll-thin min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {ranked.map(({ t, occ }) => {
          const codes = [...new Set(occ.map((f) => MONITOR_SPECIES_BY_ID[f.bird.speciesId].code))];
          return (
            <li key={t.id}>
              <button onClick={() => onOpen(t.id)} className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2 text-left hover:border-accent/50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/12 text-xs font-bold text-accent">{t.id}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {t.plantSpecies ?? "Tree"} · {t.heightM.toFixed(0)} m
                  </span>
                  <span className="mt-1 flex -space-x-1.5">
                    {codes.slice(0, 7).map((c) => (
                      <SpeciesAvatar key={c} code={c} size={20} />
                    ))}
                    {codes.length > 7 && <span className="pl-2.5 text-[10px] text-muted">+{codes.length - 7}</span>}
                  </span>
                </span>
                <span className="num text-sm font-semibold text-ink">{occ.length}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- controls ---------- */

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

function LayersMenu({ layers, onLayers, dimRest, onDimRest }: { layers: Layers3D; onLayers: (l: Layers3D) => void; dimRest: boolean; onDimRest: (v: boolean) => void }) {
  const items: [keyof Layers3D, string][] = [
    ["zones", "Habitat zones"],
    ["labels", "Zone names"],
    ["dome", "Enclosure dome"],
    ["trail", "Selected bird's path"],
  ];
  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-xs text-muted hover:text-ink">
        <Layers size={13} /> Layers
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-56 space-y-1.5 rounded-xl border border-line-strong bg-panel-solid p-3 shadow-lg">
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
      </div>
    </details>
  );
}

function ClockBar({ clock, onClock, onRestart, start, end, anchor, smooth, onSmooth }: {
  clock: { simTime: number; speed: number; playing: boolean };
  onClock: (p: Partial<{ simTime: number; speed: number; playing: boolean }>) => void;
  onRestart: () => void;
  start: number;
  end: number;
  anchor: number;
  smooth: boolean;
  onSmooth: (v: boolean) => void;
}) {
  return (
    <div className="panel flex flex-wrap items-center gap-3 px-3 py-2">
      <button
        onClick={() => onClock({ playing: !clock.playing })}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-white"
        aria-label={clock.playing ? "Pause the simulation" : "Play the simulation"}
      >
        {clock.playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>
      <div className="min-w-[200px]">
        <p className="flex items-center justify-between gap-2 text-[10px]">
          <span className="font-semibold uppercase tracking-wider text-warn">Simulated clock</span>
          <span className="num text-xs font-semibold text-ink">{fmtDateTime(clock.simTime, clock.simTime)}</span>
        </p>
        <input
          type="range"
          className="timeline"
          min={start}
          max={end}
          step={60_000}
          value={clock.simTime}
          style={{ ["--fill" as string]: `${((clock.simTime - start) / (end - start)) * 100}%` }}
          onChange={(e) => onClock({ simTime: Number(e.target.value) })}
          aria-label="Simulated time"
          title={`Demo start ${fmtTime(anchor)}`}
        />
      </div>
      <Segmented size="sm" value={String(clock.speed)} onChange={(v) => onClock({ speed: Number(v) })} options={SPEEDS.map((o) => ({ value: o.value as string, label: o.label }))} />
      <button onClick={onRestart} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-ink/5 hover:text-ink" title="Back to the demo start time" aria-label="Back to the demo start time">
        <RotateCcw size={13} />
      </button>
      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
        <input type="checkbox" checked={smooth} onChange={() => onSmooth(!smooth)} className="accent-[var(--accent)]" />
        Smooth motion
      </label>
    </div>
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
          <p className="text-[10px] text-faint">Last 24 simulated hours, whole aviary.</p>
        </div>
      </section>
    </div>
  );
}
