"use client";

import dynamic from "next/dynamic";
import { useMemo, type ReactNode } from "react";
import { Activity, ArrowRight, CheckCircle2, Crosshair, Layers, MapPin, ShieldCheck, TreePine, X, XCircle } from "lucide-react";
import {
  AGE_LABEL,
  DEVICE_STATUS_LABEL,
  FIX_STATUS,
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
  type SpeciesGroup,
  type TrackingDataset,
  type TrackingSource,
} from "@/domain/aviaryTracking";
import { MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { HISTORY_DAYS } from "@/data/aviaryTrackingSimulate";
import { SPECIES_INFO } from "@/data/aviarySpeciesInfo";
import { activityByHour, dataQuality, fmtHeight, historyRows, recentMoves, treeHistory, treeOccupants, type Fix } from "@/logic/aviaryTracking";
import { runDemoChecks } from "@/logic/aviaryDemoChecks";
import { DAY, HOUR, MIN, fmtAgo, fmtDateTime, fmtTime } from "@/logic/time";
import { resetDemoData, useTracking } from "@/state/useTracking";
import { Badge, Segmented, cx } from "@/components/ui/primitives";
import { BarList, Donut, LineChart, SplitBar } from "@/components/charts/Charts";
import { TreeSideView, type SideBird } from "./TreeSideView";
import { BirdActivity } from "./BirdActivity";

// WebGL only runs in the browser.
export const AviaryScene = dynamic(() => import("./AviaryScene").then((m) => m.AviaryScene), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Loading 3D map…</div>,
});

export type GroupFilter = "all" | SpeciesGroup;
export const GROUPS: { id: GroupFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "toucan", label: "Toucans" },
  { id: "parrot", label: "Parrots" },
  { id: "turaco", label: "Turacos" },
  { id: "pigeon", label: "Pigeons" },
  { id: "galliform", label: "Pheasants" },
  { id: "wader", label: "Waders" },
  { id: "other", label: "Others" },
];
export const SPEEDS = [
  { value: "1", label: "1×" },
  { value: "5", label: "5×" },
  { value: "20", label: "20×" },
] as const;

export const KIND_COLOR: Record<LocationKind, string> = { confirmed: "#16A34A", "computed-3d": "#2563EB", zone: "#D97706", unknown: "#94A3B8" };
export const STATUS_ORDER: FixStatus[] = ["detected", "moving", "stale", "no-signal"];
export const WINDOWS = { "6h": 6 * HOUR, "24h": DAY, "7d": HISTORY_DAYS * DAY } as const;
export type WindowId = keyof typeof WINDOWS;

export const STATUS_TONE: Record<FixStatus, "ok" | "info" | "warn" | "danger"> = { detected: "ok", moving: "info", stale: "warn", "no-signal": "danger" };

/**
 * Pieces shared by the aviary Overview and Habitat map: bird and tree cards,
 * lists, bottom panels, the movement feed and the data checks.
 */

export function TreeCard({ tree, colorBy, fixes, asOf, compact, selectedBirdId, onSelectBird, onClose, history, ds, src }: {
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
          <Field k="Plant species" v={tree.plantSpecies ?? <span className="text-muted">Not set</span>} />
          <Field k="Form" v={`${tree.form[0].toUpperCase()}${tree.form.slice(1)} (schematic)`} />
          <Field k="Total height" v={`${tree.heightM.toFixed(1)} m`} />
          <Field k="Coordinates" v={<span className="num">X {tree.x.toFixed(1)} · Y {tree.z.toFixed(1)} m</span>} />
            <Field k="Reference points" v={<span className="num">{tree.branchTiersM.map((h, i) => `R${i + 1} ${h.toFixed(1)} m`).join(" · ")}</span>} />
          <Field k="Levels" v={levels.join(", ")} />
          <Field k="Birds now" v={<span className="num font-semibold">{occ.length}</span>} />
          <Field k="Last activity" v={Number.isFinite(lastActivity) ? `${fmtTime(lastActivity)} · ${fmtAgo(lastActivity, asOf)}` : "None in 24 h"} />
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
        </>
      )}
    </section>
  );
}


export function MovementFeed({ moves, asOf, onSelect }: { moves: ReturnType<typeof recentMoves>; asOf: number; onSelect: (id: string) => void }) {
  return (
    <section className="panel p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <ArrowRight size={15} className="text-accent" /> Recent movements
      </h2>
      <p className="mt-0.5 text-[11px] text-muted">Arrivals at a new tree in the last 30 minutes. Each one updates the bird’s coordinates, height, tree and history.</p>
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
        <ShieldCheck size={15} className="text-accent" /> Data checks
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
        Reset data
      </button>
    </section>
  );
}

export function IndividualList({ fixes, limit, onMore, selectedId, onSelect, header }: {
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

export function Field({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-faint">{k}</dt>
      <dd className="mt-0.5 text-ink">{v}</dd>
    </div>
  );
}

export type BirdTab = "info" | "location" | "activity" | "history";

export function BirdCard({ fix, asOf, now, tab, onTab, win, onWin, showTrail, onTrail, onClose, onCenter, onTree }: {
  fix: Fix;
  asOf: number;
  now: number;
  tab: BirdTab;
  onTab: (t: BirdTab) => void;
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
      <div className="relative h-36 overflow-hidden" style={{ background: sp.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SPECIES_INFO[sp.code].photo.src} alt={`${sp.common}, species reference photo`} className="h-full w-full object-cover" />
        <a
          href={SPECIES_INFO[sp.code].photo.page}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 left-2 rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-muted hover:text-ink"
          title={`${SPECIES_INFO[sp.code].photo.author} · ${SPECIES_INFO[sp.code].photo.license}`}
        >
          Species photo · not this bird · Wikimedia Commons
        </a>
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
          {(["info", "location", "activity", "history"] as const).map((t) => (
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
            <p className="mt-2 text-[10px] text-faint">Coordinates are on the conceptual layout (Z = height). Clock {fmtDateTime(now, now)}.</p>
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

        {tab === "activity" && (
          <BirdActivity
            bird={bird}
            asOf={asOf}
            windowMs={WINDOWS[win]}
            windowLabel={win === "7d" ? "last 7 days" : `last ${win.replace("h", " h")}`}
            control={<Segmented size="sm" value={win} onChange={onWin} options={[{ value: "6h" as const, label: "6 h" }, { value: "24h" as const, label: "24 h" }, { value: "7d" as const, label: "7 days" }]} />}
          />
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

export function BottomPanels({ fixes, all, ds, src, asOf, level, onLevel, zoneId, onZone }: {
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
          <p className="text-[10px] text-faint">Last 24 h, whole aviary ({all.size} birds).</p>
        </div>
      </section>
    </div>
  );
}
