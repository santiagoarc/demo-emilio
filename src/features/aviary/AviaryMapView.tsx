"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Filter, Layers, Pause, Play, Radio, RotateCcw, Search, X } from "lucide-react";
import {
  FIX_STATUS,
  LEVELS,
  LOCATION_KIND,
  MONITOR_ZONES,
  MONITOR_ZONE_BY_ID,
  type FixStatus,
  type LevelId,
  type LocationKind,
  type MonitorBird,
  type Vec3,
} from "@/domain/aviaryTracking";
import { MONITOR_SPECIES, MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { STRUCTURES } from "@/data/aviaryTrackingSimulate";
import { snapshot, type Fix } from "@/logic/aviaryTracking";
import { fmtDateTime, fmtTime } from "@/logic/time";
import { useSimClock, useTracking, type TrackingState } from "@/state/useTracking";
import { Button, Chip, Segmented, Select, cx } from "@/components/ui/primitives";
import { DEFAULT_SCENE_LAYERS, type SceneLayers, type ScenePoint } from "./monitor/AviaryScene";
import { AviaryScene, BirdCard, GROUPS, KIND_COLOR, SPEEDS, STATUS_ORDER, TreeCard, WINDOWS, type GroupFilter, type WindowId } from "./monitor/AviaryParts";

const LAYER_LABEL: Record<keyof SceneLayers | "trail", string> = {
  zones: "Habitat zones",
  labels: "Zone names",
  dome: "Enclosure dome",
  trail: "Selected bird's path",
};

/** Full-screen 3D habitat map of the aviary, laid out like the penguin Habitat map. */
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

  const paramBird = params.get("bird");
  const paramTree = params.get("tree");
  const [birdId, setBirdId] = useState<string | null>(paramBird && birdById.has(paramBird) ? paramBird : null);
  const [treeId, setTreeId] = useState<string | null>(() => {
    if (paramBird && birdById.has(paramBird)) return fixes.get(paramBird)?.det?.treeId ?? null;
    return paramTree && treeById.has(paramTree) ? paramTree : null;
  });
  const [zonePanel, setZonePanel] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ pos: Vec3; key: number } | null>(() => {
    // Arriving with ?bird= or ?tree=, the map opens centred on it.
    const d = paramBird ? fixes.get(paramBird)?.det : null;
    if (d?.pos) return { pos: d.pos, key: 1 };
    if (d?.zoneId) return { pos: zoneCenter(d.zoneId), key: 1 };
    const t = paramTree ? treeById.get(paramTree) : null;
    return t ? { pos: { x: t.x, y: t.heightM * 0.55, z: t.z }, key: 1 } : null;
  });

  const [group, setGroup] = useState<GroupFilter>("all");
  // ?species=ID comes from a species page: open with that filter.
  const [speciesId, setSpeciesId] = useState(() => {
    const s = params.get("species");
    return s && MONITOR_SPECIES_BY_ID[s] ? s : "";
  });
  const [zoneId, setZoneId] = useState("");
  const [treeFilter, setTreeFilter] = useState("");
  const [level, setLevel] = useState<LevelId | "all">("all");
  const [statusPick, setStatusPick] = useState<FixStatus | null>(null);
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [colorBy, setColorBy] = useState<"species" | "status">("status");
  const [layers, setLayers] = useState<SceneLayers & { trail: boolean }>({ ...DEFAULT_SCENE_LAYERS, trail: true });
  const [dimRest, setDimRest] = useState(true);
  const [smooth, setSmooth] = useState(true);
  const [tab, setTab] = useState<"info" | "location" | "history">("location");
  const [win, setWin] = useState<WindowId>("6h");

  const filtered = group !== "all" || !!speciesId || !!zoneId || !!treeFilter;
  const matches = (f: Fix) => {
    const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
    if (group !== "all" && sp.group !== group) return false;
    if (speciesId && f.bird.speciesId !== speciesId) return false;
    if (zoneId && f.det?.zoneId !== zoneId) return false;
    if (treeFilter && f.det?.treeId !== treeFilter) return false;
    return true;
  };
  const isActive = (f: Fix) => matches(f) && (level === "all" || f.levelId === level) && (!statusPick || f.status === statusPick);

  const all = useMemo(() => [...fixes.values()], [fixes]);
  const inScope = useMemo(() => all.filter(matches), [all, group, speciesId, zoneId, treeFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => {
    const c: Record<FixStatus, number> = { detected: 0, moving: 0, stale: 0, "no-signal": 0 };
    for (const f of inScope) c[f.status]++;
    return c;
  }, [inScope]);

  const points: ScenePoint[] = useMemo(() => {
    const out: ScenePoint[] = [];
    for (const f of all) {
      if (!f.det?.pos) continue;
      const active = isActive(f);
      if (!active && !dimRest && (filtered || statusPick)) continue;
      const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
      out.push({
        id: f.bird.id,
        pos: f.det.pos,
        color: colorBy === "species" ? sp.color : FIX_STATUS[f.status].color,
        dim: !active,
        label: `${f.bird.id} · ${sp.common} · ${FIX_STATUS[f.status].label}`,
      });
    }
    return out;
  }, [all, colorBy, dimRest, filtered, level, statusPick, group, speciesId, zoneId, treeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const selFix = birdId ? fixes.get(birdId) ?? null : null;
  const selTree = treeId ? treeById.get(treeId) ?? null : null;

  const trail = useMemo(() => {
    if (!birdId || !layers.trail || !selFix || selFix.bird.device.status === "intermittent") return null;
    return src.history(birdId, asOf - WINDOWS[win], asOf).filter((s) => s.start <= asOf).map((s) => s.pos);
  }, [birdId, layers.trail, selFix, src, asOf, win]);

  const selectBird = (id: string) => {
    const f = fixes.get(id);
    setBirdId(id);
    setZonePanel(null);
    setTreeId(f?.det?.treeId ?? null);
    if (f?.det?.pos) setFocus({ pos: f.det.pos, key: Date.now() });
    else if (f?.det?.zoneId) setFocus({ pos: zoneCenter(f.det.zoneId), key: Date.now() });
  };
  const selectTree = (id: string) => {
    const t = treeById.get(id);
    setBirdId(null);
    setZonePanel(null);
    setTreeId(id);
    if (t) setFocus({ pos: { x: t.x, y: t.heightM * 0.55, z: t.z }, key: Date.now() });
  };
  // The sidebar search (Ctrl K) changes ?bird= while the map is open: follow it.
  const [seenParam, setSeenParam] = useState(paramBird);
  useEffect(() => {
    if (paramBird === seenParam) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenParam(paramBird);
    if (paramBird && birdById.has(paramBird)) selectBird(paramBird);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramBird]);

  const closeAll = () => {
    setBirdId(null);
    setTreeId(null);
    setZonePanel(null);
  };

  const highlightZone = zonePanel ?? (zoneId || null) ?? (selFix?.det?.kind === "zone" ? selFix.det.zoneId : null);
  const zoneBirds = zonePanel ? inScope.filter((f) => f.det?.zoneId === zonePanel) : [];
  const located = inScope.filter((f) => f.det?.pos).length;

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col md:h-screen lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* The map fills its space. */}
        <div className="relative min-h-[320px] flex-1">
          <AviaryScene
            trees={registry.trees}
            structures={STRUCTURES}
            points={points}
            selectedBirdId={birdId}
            selectedTreeId={treeId ?? (treeFilter || null)}
            highlightZoneId={highlightZone}
            precision={selFix?.det?.pos && selFix.det.precisionM ? { pos: selFix.det.pos, r: selFix.det.precisionM } : null}
            trail={trail}
            level={level}
            mode={mode}
            focus={focus}
            dimTrees={level !== "all"}
            smooth={smooth}
            layers={layers}
            onSelectBird={selectBird}
            onSelectTree={selectTree}
            onSelectZone={(z) => {
              setZonePanel(z === zonePanel ? null : z);
              setBirdId(null);
              setTreeId(null);
            }}
          />
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm">
              <span className={cx("h-2 w-2 rounded-full", clock.playing ? "animate-pulse bg-danger" : "bg-faint")} />
              {clock.playing ? "Live · simulated" : "Paused · simulated"}
            </span>
            <span className="rounded-md bg-warn px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white shadow-sm">DEMO / SIMULATED DATA</span>
          </div>
          <div className="absolute right-3 top-3 flex flex-wrap items-center justify-end gap-1.5">
            <div className="rounded-xl bg-white/85 shadow-sm backdrop-blur">
              <Segmented
                size="sm"
                value={level}
                onChange={setLevel}
                options={[{ value: "all" as const, label: "All levels" }, ...LEVELS.map((l) => ({ value: l.id, label: l.id === "upper" ? "> 18 m" : l.id === "ground" ? "Ground" : `${l.min === 0.5 ? 0 : l.min}–${l.max} m` }))]}
              />
            </div>
            <div className="rounded-xl bg-white/85 shadow-sm backdrop-blur">
              <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "2d", label: "2D" }, { value: "3d", label: "3D" }]} />
            </div>
          </div>
        </div>

        {/* Simulated clock, below the map */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-panel-solid/80 px-4 py-3">
          <button
            onClick={() => setClock({ playing: !clock.playing })}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white transition hover:bg-[#0b8178]"
            aria-label={clock.playing ? "Pause the simulation" : "Play the simulation"}
          >
            {clock.playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
          </button>
          <div className="min-w-[220px] flex-1">
            <div className="mb-0.5 flex flex-wrap items-center justify-between gap-x-3 text-[11px]">
              <span className="text-muted">
                <span className="inline-flex items-center gap-1.5 text-ok">
                  <Radio size={12} /> Simulated clock
                </span>{" "}
                · <span className="font-semibold text-ink">{fmtDateTime(asOf, asOf)}</span>
              </span>
              <span className="text-faint">Simulated movement · not real-time tracking</span>
            </div>
            <input
              type="range"
              className="timeline"
              min={ds.windowStart}
              max={ds.horizon}
              step={60_000}
              value={asOf}
              style={{ ["--fill" as string]: `${((asOf - ds.windowStart) / (ds.horizon - ds.windowStart)) * 100}%` }}
              onChange={(e) => setClock({ simTime: Number(e.target.value) })}
              aria-label="Simulated time"
            />
            <div className="flex justify-between text-[10px] text-faint">
              <span>{fmtDateTime(ds.windowStart, asOf)}</span>
              <span>Demo start · {fmtTime(registry.anchor)}</span>
              <span>{fmtDateTime(ds.horizon, asOf)}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <Segmented size="sm" value={String(clock.speed)} onChange={(v) => setClock({ speed: Number(v) })} options={SPEEDS.map((o) => ({ value: o.value as string, label: o.label }))} />
              <Button size="sm" variant="outline" onClick={restart} title="Back to the demo start time">
                <RotateCcw size={12} /> Start
              </Button>
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
              <input type="checkbox" checked={smooth} onChange={() => setSmooth((v) => !v)} className="accent-[var(--accent)]" />
              Smooth motion
            </label>
          </div>
        </div>
      </div>

      {/* Right column: counts, filters, layers and details of the selection */}
      <aside className="flex max-h-[45vh] w-full shrink-0 flex-col border-t border-line bg-panel-solid/70 lg:max-h-none lg:w-[360px] lg:border-l lg:border-t-0">
        <div className="border-b border-line px-4 py-3">
          <p className="eyebrow">Habitat Map</p>
          <h1 className="text-lg font-semibold tracking-tight">The Rainforest</h1>
          <BirdFind birds={registry.birds} onPick={selectBird} />
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <MapStat label="On the map" value={located} sub={`/ ${inScope.length}`} on={!statusPick} onClick={() => setStatusPick(null)} />
            {(["detected", "moving", "no-signal"] as FixStatus[]).map((st) => (
              <MapStat key={st} label={FIX_STATUS[st].label} color={FIX_STATUS[st].color} value={counts[st]} on={statusPick === st} onClick={() => setStatusPick(statusPick === st ? null : st)} />
            ))}
          </div>
        </div>

        {selFix ? (
          <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
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
              onClose={closeAll}
              onCenter={() => selectBird(selFix.bird.id)}
              onTree={selectTree}
            />
            {selTree && (
              <TreeCard tree={selTree} colorBy={colorBy} fixes={fixes} asOf={asOf} now={asOf} compact selectedBirdId={birdId} onSelectBird={selectBird} onClose={() => setTreeId(null)} history={false} ds={ds} src={src} />
            )}
          </div>
        ) : selTree ? (
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
            <TreeCard tree={selTree} colorBy={colorBy} fixes={fixes} asOf={asOf} now={asOf} compact={false} selectedBirdId={null} onSelectBird={selectBird} onClose={closeAll} history ds={ds} src={src} />
          </div>
        ) : zonePanel ? (
          <div className="slide-in flex min-h-0 flex-1 flex-col">
            <div className="relative border-b border-line p-4">
              <button onClick={() => setZonePanel(null)} className="absolute right-3 top-3 rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
                <X size={16} />
              </button>
              <p className="eyebrow">Zone {MONITOR_ZONE_BY_ID[zonePanel].code} · conceptual</p>
              <h2 className="mt-1 text-lg font-semibold">{MONITOR_ZONE_BY_ID[zonePanel].name}</h2>
              <p className="mt-1 text-xs text-muted">{registry.trees.filter((t) => t.zoneId === zonePanel).length} demo trees · {zoneBirds.length} birds last located here</p>
              <div className="mt-3">
                <Button size="sm" variant={zoneId === zonePanel ? "primary" : "outline"} onClick={() => setZoneId(zoneId === zonePanel ? "" : zonePanel)}>
                  <Filter size={13} /> {zoneId === zonePanel ? "Remove filter" : "Filter by zone"}
                </Button>
              </div>
            </div>
            <BirdRows fixes={zoneBirds} onSelect={selectBird} />
          </div>
        ) : (
          <div className="scroll-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <div>
              <p className="eyebrow mb-2 flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5">
                  <Filter size={12} /> Filters
                </span>
                {(filtered || level !== "all") && (
                  <button
                    onClick={() => (setGroup("all"), setSpeciesId(""), setZoneId(""), setTreeFilter(""), setLevel("all"))}
                    className="normal-case tracking-normal text-accent hover:underline"
                  >
                    Clear
                  </button>
                )}
              </p>
              <FilterRow label="Group">
                <div className="flex flex-wrap gap-1.5">
                  {GROUPS.map((g) => (
                    <Chip key={g.id} active={group === g.id} onClick={() => (setGroup(g.id), setSpeciesId(""))}>
                      {g.label}
                    </Chip>
                  ))}
                </div>
              </FilterRow>
              <FilterRow label="Species">
                <Select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)} className="h-8 w-full text-xs" aria-label="Species">
                  <option value="">All species</option>
                  {MONITOR_SPECIES.filter((s) => group === "all" || s.group === group).map((s) => (
                    <option key={s.id} value={s.id}>{s.code} · {s.common} ({s.demoCount})</option>
                  ))}
                </Select>
              </FilterRow>
              <FilterRow label="Zone">
                <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="h-8 w-full text-xs" aria-label="Zone">
                  <option value="">+ Zone</option>
                  {MONITOR_ZONES.map((z) => (
                    <option key={z.id} value={z.id}>{z.code} · {z.name}</option>
                  ))}
                </Select>
              </FilterRow>
              <FilterRow label="Tree">
                <Select value={treeFilter} onChange={(e) => setTreeFilter(e.target.value)} className="h-8 w-full text-xs" aria-label="Tree">
                  <option value="">+ Tree</option>
                  {registry.trees.map((t) => (
                    <option key={t.id} value={t.id}>{t.id} · {MONITOR_ZONE_BY_ID[t.zoneId].code} · {t.heightM.toFixed(0)} m</option>
                  ))}
                </Select>
              </FilterRow>
            </div>
            <div>
              <p className="eyebrow mb-2 flex items-center gap-1.5">
                <Layers size={12} /> Layers
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {(Object.keys(LAYER_LABEL) as (keyof typeof layers)[]).map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 text-xs text-muted hover:text-ink">
                    <input type="checkbox" checked={layers[k]} onChange={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} className="accent-[var(--accent)]" />
                    {LAYER_LABEL[k]}
                  </label>
                ))}
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted hover:text-ink">
                  <input type="checkbox" checked={dimRest} onChange={() => setDimRest((v) => !v)} className="accent-[var(--accent)]" />
                  Dim the rest
                </label>
              </div>
              <div className="mt-2.5 flex items-center gap-2 text-xs text-muted">
                Marker colour
                <Segmented size="sm" value={colorBy} onChange={setColorBy} options={[{ value: "status", label: "Status" }, { value: "species", label: "Species" }]} />
              </div>
            </div>
            <Legend />
            <p className="text-[11px] text-faint">Click a bird, a tree or a zone label to see its details here.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2.5 grid grid-cols-[58px_1fr] items-start gap-2">
      <span className="pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</span>
      {children}
    </div>
  );
}

function BirdRows({ fixes, onSelect }: { fixes: Fix[]; onSelect: (id: string) => void }) {
  return (
    <div className="scroll-thin flex-1 overflow-y-auto p-3">
      {fixes.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">No bird matching the current filters was last located here.</p>}
      <ul>
        {fixes.map((f) => (
          <li key={f.bird.id}>
            <button onClick={() => onSelect(f.bird.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-ink/[0.04]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: MONITOR_SPECIES_BY_ID[f.bird.speciesId].color }} />
              <span className="w-[64px] font-mono text-xs">{f.bird.id}</span>
              <span className="flex-1 truncate text-[11px] text-faint">{MONITOR_SPECIES_BY_ID[f.bird.speciesId].common}</span>
              <span className="text-[11px] text-muted">{f.det?.pos ? `${f.det.pos.y.toFixed(1)} m` : "zone"}</span>
              <span className="h-2 w-2 rounded-full" style={{ background: FIX_STATUS[f.status].color }} title={FIX_STATUS[f.status].label} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Finds a bird by ID, species (common or scientific) or name and locates it on the map. */
function BirdFind({ birds, onPick }: { birds: MonitorBird[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return birds
      .filter((b) => {
        const sp = MONITOR_SPECIES_BY_ID[b.speciesId];
        return `${b.id} ${b.name ?? ""} ${sp.common} ${sp.commonEs} ${sp.scientific}`.toLowerCase().includes(t);
      })
      .slice(0, 8);
  }, [q, birds]);
  const pick = (b: MonitorBird) => {
    onPick(b.id);
    setQ("");
    setOpen(false);
  };
  return (
    <div className="relative mt-3">
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        value={q}
        onChange={(e) => (setQ(e.target.value), setOpen(true), setHi(0))}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setHi((h) => Math.min(h + 1, results.length - 1));
          else if (e.key === "ArrowUp") setHi((h) => Math.max(h - 1, 0));
          else if (e.key === "Enter" && results[hi]) pick(results[hi]);
          else if (e.key === "Escape") setOpen(false);
          else return;
          e.preventDefault();
        }}
        placeholder="Find a bird (ID, species, name…)"
        aria-label="Find a bird"
        className="h-9 w-full rounded-xl border border-line-strong bg-panel-solid pl-8 pr-3 text-xs text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      {open && q.trim() && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line-strong bg-panel-solid p-1 shadow-[0_4px_14px_rgba(11,36,64,0.10)]">
          {results.length === 0 && <li className="px-3 py-2.5 text-xs text-muted">No birds match.</li>}
          {results.map((b, i) => {
            const sp = MONITOR_SPECIES_BY_ID[b.speciesId];
            return (
              <li key={b.id}>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(b)}
                  className={cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left", i === hi && "bg-ink/[0.05]")}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sp.color }} />
                  <span className="w-[64px] shrink-0 font-mono text-xs">{b.id}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">{b.name ?? sp.common}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MapStat({ label, value, sub, color, on, onClick }: { label: string; value: number; sub?: string; color?: string; on?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cx("flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition", on ? "border-accent/60 bg-accent/10" : "border-line bg-ink/[0.05] hover:border-line-strong")}
    >
      <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-muted">
        {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
        {label}
      </p>
      <p className="num shrink-0 text-sm font-semibold">
        {value}
        {sub && <span className="text-xs font-normal text-faint"> {sub}</span>}
      </p>
    </button>
  );
}

function Legend() {
  return (
    <div>
      <p className="eyebrow mb-2">Legend</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-muted">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5" title={FIX_STATUS[s].hint}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: FIX_STATUS[s].color }} />
            {FIX_STATUS[s].label}
          </span>
        ))}
        {(["confirmed", "computed-3d", "zone"] as LocationKind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5" title={LOCATION_KIND[k].hint}>
            <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: KIND_COLOR[k] }} />
            {LOCATION_KIND[k].label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-faint">
        Marker colour = status (or species). The halo around a selected bird is its uncertainty; zone-only birds are not drawn as points, their zone is highlighted. Flights follow an arc between trees; all movement is simulated.
      </p>
    </div>
  );
}
