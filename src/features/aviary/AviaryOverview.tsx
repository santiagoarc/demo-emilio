"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Bird, Feather, Map as MapIcon, MapPinned, Navigation, Pause, Play, Radio, X, type LucideIcon } from "lucide-react";
import { FIX_STATUS, MONITOR_ZONE_BY_ID } from "@/domain/aviaryTracking";
import { MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { STRUCTURES } from "@/data/aviaryTrackingSimulate";
import { fmtHeight, recentMoves, snapshot } from "@/logic/aviaryTracking";
import { MIN, fmtAgo, fmtTime } from "@/logic/time";
import { useSimClock, useTracking, type TrackingState } from "@/state/useTracking";
import type { ScenePoint } from "./monitor/AviaryScene";
import { AviaryScene, BottomPanels, MovementFeed } from "./monitor/AviaryParts";

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

/** Aviary landing page, laid out like the penguin Overview. */
export function AviaryOverview() {
  const t = useTracking();
  return <OverviewInner key={t.registry.createdAt} {...t} />;
}

function OverviewInner({ registry, ds, src, treeById }: TrackingState) {
  const { clock, set: setClock } = useSimClock(registry, ds.horizon);
  const asOf = clock.simTime;
  const fixes = useMemo(() => snapshot(ds, src, asOf), [ds, src, asOf]);
  const all = useMemo(() => [...fixes.values()], [fixes]);
  const [birdId, setBirdId] = useState<string | null>(null);
  const [treeId, setTreeId] = useState<string | null>(null);

  const total = all.length;
  const detected = all.filter((f) => f.status === "detected").length;
  const moving = all.filter((f) => f.status === "moving").length;
  const located = all.filter((f) => f.det?.pos).length;

  const points: ScenePoint[] = useMemo(
    () =>
      all
        .filter((f) => f.det?.pos)
        .map((f) => ({
          id: f.bird.id,
          pos: f.det!.pos!,
          color: MONITOR_SPECIES_BY_ID[f.bird.speciesId].color,
          dim: false,
          label: `${f.bird.id} · ${MONITOR_SPECIES_BY_ID[f.bird.speciesId].common}`,
        })),
    [all],
  );
  const moves = useMemo(() => recentMoves(ds, asOf, 30 * MIN, 8), [ds, asOf]);
  const bySpecies = useMemo(
    () =>
      registry.species
        .map((s) => ({ s, n: registry.birds.filter((b) => b.speciesId === s.id).length }))
        .sort((a, b) => b.n - a.n),
    [registry],
  );

  const sel = birdId ? fixes.get(birdId) ?? null : null;
  const tree = treeId ? treeById.get(treeId) ?? null : null;
  const fullMapHref = sel ? `/aviary/map?bird=${sel.bird.id}` : tree ? `/aviary/map?tree=${tree.id}` : "/aviary/map";

  const kpis: { label: string; value: number; share?: number; icon: LucideIcon; color: string; href: string }[] = [
    { label: "Registered birds", value: total, icon: Bird, color: "#0e9f95", href: "/aviary/birds" },
    { label: "Detected now", value: detected, share: pct(detected, total), icon: Radio, color: FIX_STATUS.detected.color, href: "/aviary/map" },
    { label: "Moving now", value: moving, share: pct(moving, total), icon: Navigation, color: FIX_STATUS.moving.color, href: "/aviary/map" },
    { label: "Species", value: registry.species.length, icon: Feather, color: "#a78bfa", href: "/aviary/species" },
  ];

  return (
    <div className="space-y-3 px-4 pb-6 pt-4 lg:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Aviary · The Rainforest</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Aviary overview</h1>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full bg-ok" />
              Simulated data · clock at {fmtTime(asOf)}
            </span>
            <span className="rounded-md bg-warn px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">DEMO / SIMULATED DATA</span>
          </div>
        </div>
        <button
          onClick={() => setClock({ playing: !clock.playing })}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong bg-panel-solid px-3 text-xs font-medium text-ink hover:border-accent/50"
        >
          {clock.playing ? <Pause size={14} /> : <Play size={14} />} {clock.playing ? "Pause simulation" : "Play simulation"}
        </button>
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
                <h3 className="text-[15px] font-semibold tracking-tight">Habitat map</h3>
                <p className="text-[11px] text-muted">Latest simulated location of each bird · {located} with a 3D position · click a bird or a tree</p>
              </div>
            </div>
            <Link href={fullMapHref} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-semibold text-white hover:bg-[#0b8178]">
              <MapPinned size={14} /> Open full map
            </Link>
          </header>
          <div className="relative h-[clamp(340px,calc(100vh-290px),700px)] w-full border-y border-line">
            <AviaryScene
              trees={registry.trees}
              structures={STRUCTURES}
              points={points}
              selectedBirdId={birdId}
              selectedTreeId={treeId}
              highlightZoneId={null}
              precision={null}
              trail={null}
              level="all"
              mode="3d"
              focus={null}
              dimTrees={false}
              smooth
              onSelectBird={(id) => (setBirdId(id), setTreeId(null))}
              onSelectTree={(id) => (setTreeId(id), setBirdId(null))}
              onSelectZone={() => {}}
            />
            {sel && (
              <MapCard onClose={() => setBirdId(null)}>
                <p className="font-mono text-[11px] font-semibold text-muted">{sel.bird.id}</p>
                <p className="text-sm font-semibold">{MONITOR_SPECIES_BY_ID[sel.bird.speciesId].common}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  <span style={{ color: FIX_STATUS[sel.status].color }}>●</span> {FIX_STATUS[sel.status].label}
                  {sel.det?.zoneId && ` · ${MONITOR_ZONE_BY_ID[sel.det.zoneId].name}`}
                  {sel.det?.treeId && ` · ${sel.det.treeId}`}
                  {sel.det?.pos && ` · ${fmtHeight(sel.det.pos.y)}`}
                  {sel.det && ` · ${fmtAgo(sel.det.at, asOf)}`}
                </p>
                <Link href={fullMapHref} className="mt-2.5 inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-semibold text-white">
                  Open in Habitat Map <ArrowUpRight size={12} />
                </Link>
              </MapCard>
            )}
            {!sel && tree && (
              <MapCard onClose={() => setTreeId(null)}>
                <p className="eyebrow">Tree · {MONITOR_ZONE_BY_ID[tree.zoneId].name}</p>
                <p className="text-sm font-semibold">{tree.id} · {tree.heightM.toFixed(1)} m</p>
                <p className="mt-0.5 text-[11px] text-muted">{all.filter((f) => f.det?.treeId === tree.id).length} birds located in this tree now</p>
                <Link href={fullMapHref} className="mt-2.5 inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-semibold text-white">
                  Open in Habitat Map <ArrowUpRight size={12} />
                </Link>
              </MapCard>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-[11px] text-muted">
            {(["detected", "moving", "stale", "no-signal"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: FIX_STATUS[s].color }} />
                {FIX_STATUS[s].label}
              </span>
            ))}
            <span className="ml-auto text-faint">Conceptual layout · simulated movement</span>
          </div>
        </section>

        <div className="space-y-3">
          <section className="panel p-4">
            <header className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                <Feather size={16} className="text-accent" /> Species breakdown
              </h3>
              <Link href="/aviary/species" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                View all <ArrowRight size={12} />
              </Link>
            </header>
            <ul className="space-y-2">
              {bySpecies.slice(0, 8).map(({ s, n }) => (
                <li key={s.id}>
                  <Link href={`/aviary/species/${s.id}`} className="flex items-center gap-2.5 hover:text-accent">
                    <span className="grid h-7 w-9 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white" style={{ background: s.color }}>{s.code}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{s.common}</span>
                    <span className="num text-[13px] font-semibold">{n}</span>
                    <span className="num w-8 text-right text-[11px] text-faint">{pct(n, total)}%</span>
                  </Link>
                  <div className="ml-[46px] mt-1 h-1 overflow-hidden rounded-full bg-ink/[0.05]">
                    <div className="h-full rounded-full" style={{ width: `${(n / bySpecies[0].n) * 100}%`, background: s.color }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-faint">{registry.species.length} species in the demo catalogue · counts are fictional.</p>
          </section>
          <MovementFeed moves={moves} asOf={asOf} onSelect={(id) => (setBirdId(id), setTreeId(null))} />
        </div>
      </div>

      <BottomPanels fixes={all} all={fixes} ds={ds} src={src} asOf={asOf} level="all" onLevel={() => {}} zoneId={null} onZone={() => {}} />
    </div>
  );
}

function MapCard({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute bottom-3 left-3 w-[280px] rounded-xl border border-line-strong bg-panel-solid/95 p-3 shadow-lg backdrop-blur">
      <button onClick={onClose} className="absolute right-2 top-2 rounded-md p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
        <X size={14} />
      </button>
      {children}
    </div>
  );
}
