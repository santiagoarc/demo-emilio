"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Minus, Plus, RotateCcw } from "lucide-react";
import { FOOTPRINT, MONITOR_ZONES, type MonitorZone, type Vec3 } from "@/domain/aviaryTracking";
import { GREAT_TREE } from "@/domain/aviaryLayout";
import { REFERENCE_IMAGE, groundScale, toImage } from "@/domain/aviaryImageProjection";
import { cx } from "@/components/ui/primitives";
import type { AviarySceneProps, ScenePoint } from "./AviaryScene";

const IW = REFERENCE_IMAGE.width;
const IH = REFERENCE_IMAGE.height;
/** Dot radius and grouping cell, in screen pixels. */
const DOT = 4.5;
const CELL = 22;
const MAX_ZOOM = 6;

type Props = Pick<
  AviarySceneProps,
  "trees" | "points" | "selectedBirdId" | "selectedTreeId" | "highlightZoneId" | "precision" | "trail" | "focus" | "smooth" | "layers" | "cluster" | "onSelectBird" | "onSelectTree" | "onSelectZone" | "onSelectGroup"
>;

function zoneAnchor(zone: MonitorZone): Vec3 {
  if (!zone.sector) return { x: GREAT_TREE.x - 9, y: 0, z: GREAT_TREE.z + 9 };
  const mid = (((zone.sector[0] + zone.sector[1]) / 2) * Math.PI) / 180;
  return { x: Math.cos(mid) * FOOTPRINT.rx * 0.8, y: 0, z: Math.sin(mid) * FOOTPRINT.rz * 0.8 };
}

/**
 * The aviary drawn on the reference render: birds as dots in their species
 * colour, trees as clickable crowns, zones as small chips. Positions come from
 * an approximate projection of the plan onto the picture (see
 * aviaryImageProjection), so they are illustrative.
 */
export function AviaryImageMap(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<{ k: number; tx: number; ty: number } | null>(null);
  const [hint, setHint] = useState(false);
  const [tip, setTipState] = useState<{ x: number; y: number; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  /** Tip at a pointer position (client coordinates), stored relative to the map. */
  const setTip = useCallback((t: { x: number; y: number; text: string } | null) => {
    const r = wrapRef.current?.getBoundingClientRect();
    setTipState(t && r ? { x: t.x - r.left, y: t.y - r.top, text: t.text } : null);
  }, []);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The picture fills the map (cover); panning reaches the cropped edges.
  const k0 = size.w && size.h ? Math.max(size.w / IW, size.h / IH) : 0;
  const fit = (): { k: number; tx: number; ty: number } => ({ k: k0, tx: (size.w - IW * k0) / 2, ty: (size.h - IH * k0) / 2 });
  const v = view ?? (k0 ? fit() : { k: 1, tx: 0, ty: 0 });
  const clampView = (n: { k: number; tx: number; ty: number }) => {
    const k = Math.min(k0 * MAX_ZOOM, Math.max(k0, n.k));
    const minTx = Math.min(0, size.w - IW * k), maxTx = Math.max(0, size.w - IW * k);
    const minTy = Math.min(0, size.h - IH * k), maxTy = Math.max(0, size.h - IH * k);
    return { k, tx: Math.min(maxTx, Math.max(minTx, n.tx)), ty: Math.min(maxTy, Math.max(minTy, n.ty)) };
  };
  const zoomAt = (f: number, sx = size.w / 2, sy = size.h / 2) => {
    const k = Math.min(k0 * MAX_ZOOM, Math.max(k0, v.k * f));
    setView(clampView({ k, tx: sx - ((sx - v.tx) / v.k) * k, ty: sy - ((sy - v.ty) / v.k) * k }));
  };
  const centerOn = (u: number, vv: number, k = v.k) => setView(clampView({ k, tx: size.w / 2 - u * k, ty: size.h / 2 - vv * k }));

  // Fly to the selected bird or tree.
  const { focus } = props;
  useEffect(() => {
    if (!focus || !k0) return;
    const p = toImage(focus.pos);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    centerOn(p.u, p.v, Math.max(v.k, k0 * 2.2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, k0]);

  // Ctrl/⌘ + wheel zooms; a plain wheel scrolls the page and shows a hint.
  useEffect(() => {
    const el = wrapRef.current!;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        setHint(true);
        window.setTimeout(() => setHint(false), 1100);
        return;
      }
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const { points, selectedBirdId, cluster } = props;
  // Picture positions of the birds, and groups of dots that overlap at this zoom.
  const placed = useMemo(() => points.map((p) => ({ p, ...toImage(p.pos) })), [points]);
  const { singles, groups } = useMemo(() => {
    if (cluster === false) return { singles: placed, groups: [] as { u: number; v: number; ids: string[] }[] };
    const cells = new Map<number, typeof placed>();
    const singles: typeof placed = [];
    for (const d of placed) {
      if (d.p.id === selectedBirdId || d.p.dim) {
        singles.push(d);
        continue;
      }
      const key = Math.floor((d.u * v.k) / CELL) * 4096 + Math.floor((d.v * v.k) / CELL);
      const c = cells.get(key);
      if (c) c.push(d);
      else cells.set(key, [d]);
    }
    const groups: { u: number; v: number; ids: string[] }[] = [];
    for (const list of cells.values()) {
      if (list.length < 4) singles.push(...list);
      else groups.push({ u: list.reduce((a, d) => a + d.u, 0) / list.length, v: list.reduce((a, d) => a + d.v, 0) / list.length, ids: list.map((d) => d.p.id) });
    }
    return { singles, groups };
  }, [placed, v.k, cluster, selectedBirdId]);

  const { trees, selectedTreeId, highlightZoneId, precision, trail } = props;
  const treeSpots = useMemo(
    () =>
      trees.map((t) => {
        const c = toImage({ x: t.x, y: t.heightM * 0.7, z: t.z });
        const top = toImage({ x: t.x, y: t.heightM, z: t.z });
        return { t, u: c.u, v: c.v, r: Math.max(10, t.crownRadiusM * groundScale(t.x, t.z) * 0.85), top };
      }),
    [trees],
  );
  const layers = props.layers ?? { zones: true, labels: true, dome: true };
  const near = v.k >= k0 * 1.6;
  const screen = (u: number, vv: number) => ({ x: v.tx + u * v.k, y: v.ty + vv * v.k });

  // Tree IDs once zoomed in, skipping any that would overlap.
  const treeLabels = useMemo(() => {
    if (!near || !layers.labels) return [];
    const out: { id: string; x: number; y: number }[] = [];
    for (const s of treeSpots) {
      if (s.t.id === selectedTreeId) continue;
      const p = { x: v.tx + s.top.u * v.k, y: v.ty + s.top.v * v.k };
      if (p.x < 0 || p.y < 0 || p.x > size.w || p.y > size.h) continue;
      if (out.some((o) => Math.abs(o.x - p.x) < 34 && Math.abs(o.y - p.y) < 18)) continue;
      out.push({ id: s.t.id, ...p });
    }
    return out;
  }, [near, layers.labels, treeSpots, selectedTreeId, v.k, v.tx, v.ty, size.w, size.h]);

  const selTree = treeSpots.find((s) => s.t.id === selectedTreeId);
  const selBird = placed.find((d) => d.p.id === selectedBirdId);
  const prec = precision ? { ...toImage(precision.pos), r: precision.r * groundScale(precision.pos.x, precision.pos.z) } : null;
  const trailPts = trail && trail.length > 1 ? trail.map((p) => toImage(p)) : null;

  return (
    <div
      ref={wrapRef}
      className={cx("relative h-full w-full select-none overflow-hidden bg-[#dfe9e6]", dragging ? "cursor-grabbing" : "cursor-grab")}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !e.buttons) return;
        if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) {
          d.moved = true;
          setDragging(true);
        }
        if (d.moved) setView(clampView({ k: v.k, tx: d.tx + e.clientX - d.x, ty: d.ty + e.clientY - d.y }));
      }}
      onPointerUp={() => {
        // A click (no drag) on the background clears nothing; markers handle their own clicks.
        setDragging(false);
        window.setTimeout(() => (drag.current = null), 0);
      }}
      role="application"
      aria-label="Aviary map on the reference picture. Drag to pan, Ctrl + scroll to zoom, click a bird or a tree."
    >
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: IW, height: IH, transform: `translate(${v.tx}px, ${v.ty}px) scale(${v.k})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={REFERENCE_IMAGE.src} alt="Reference render of the aviary (illustrative)" width={IW} height={IH} draggable={false} className="pointer-events-none block" />
        <svg width={IW} height={IH} viewBox={`0 0 ${IW} ${IH}`} className="absolute inset-0 overflow-visible">
          {/* Tree crowns: clickable, outlined when selected or hovered. */}
          {treeSpots.map((s) => (
            <circle
              key={s.t.id}
              cx={s.u}
              cy={s.v}
              r={s.r}
              fill="transparent"
              stroke={s.t.id === selectedTreeId ? "#0e9f95" : "transparent"}
              strokeWidth={3 / v.k}
              className="cursor-pointer hover:stroke-white/80"
              style={{ strokeDasharray: s.t.id === selectedTreeId ? undefined : `${6 / v.k} ${4 / v.k}` }}
              onClick={() => !drag.current?.moved && props.onSelectTree(s.t.id)}
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text: `${s.t.id}${s.t.plantSpecies ? ` · ${s.t.plantSpecies}` : ""} · ${s.t.heightM.toFixed(1)} m` })}
              onMouseLeave={() => setTip(null)}
            />
          ))}
          {trailPts && <polyline points={trailPts.map((p) => `${p.u},${p.v}`).join(" ")} fill="none" stroke="#2563eb" strokeWidth={2 / v.k} opacity={0.85} />}
          {prec && <circle cx={prec.u} cy={prec.v} r={Math.max(prec.r, 6 / v.k)} fill="#2563eb" opacity={0.16} />}
          <BirdDots dots={singles} k={v.k} selectedId={selectedBirdId} smooth={props.smooth !== false} onBird={(id) => !drag.current?.moved && props.onSelectBird(id)} onTip={setTip} />
          {groups.map((g) => (
            <g
              key={g.ids[0]}
              transform={`translate(${g.u} ${g.v}) scale(${1 / v.k})`}
              className="cursor-pointer"
              onClick={() => {
                if (drag.current?.moved) return;
                if (v.k >= k0 * MAX_ZOOM - 0.01) props.onSelectGroup?.(g.ids);
                else centerOn(g.u, g.v, v.k * 2);
              }}
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text: v.k >= k0 * MAX_ZOOM - 0.01 ? `${g.ids.length} birds at about the same spot · click to list them` : `${g.ids.length} birds here · click to zoom in` })}
              onMouseLeave={() => setTip(null)}
            >
              <circle r={9 + Math.min(6, g.ids.length / 4)} fill="#ffffff" stroke="#0b2440" strokeWidth={2} />
              <text textAnchor="middle" dy="0.35em" className="fill-[#0b2440] text-[10px] font-bold">
                {g.ids.length}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Screen-space labels: zone chips, tree IDs, selection. */}
      <div className="pointer-events-none absolute inset-0">
        {layers.labels &&
          MONITOR_ZONES.map((z) => {
            const a = toImage(zoneAnchor(z));
            const p = screen(a.u, a.v);
            return (
              <button
                key={z.id}
                onClick={() => props.onSelectZone(z.id)}
                title={`${z.code} · ${z.name}`}
                className={cx("pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-md border bg-panel-solid/90 px-1.5 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur", highlightZoneId === z.id ? "border-ink/40 text-ink" : "border-line-strong text-muted")}
                style={{ left: p.x, top: p.y, borderLeft: `3px solid ${z.color}` }}
              >
                {z.code}
                <span className={cx("ml-1 font-medium", highlightZoneId === z.id ? "inline" : "hidden xl:inline")}>{z.name}</span>
              </button>
            );
          })}
        {treeLabels.map((l) => (
          <span key={l.id} className="absolute -translate-x-1/2 -translate-y-full rounded bg-white/90 px-1 text-[9px] font-semibold text-ink shadow-sm ring-1 ring-line" style={{ left: l.x, top: l.y }}>
            {l.id}
          </span>
        ))}
        {selTree && (() => {
          const p = screen(selTree.top.u, selTree.top.v);
          return (
            <span className="absolute -translate-x-1/2 -translate-y-full rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white shadow" style={{ left: p.x, top: p.y }}>
              {selTree.t.id}
            </span>
          );
        })()}
        {selBird && (() => {
          const p = screen(selBird.u, selBird.v);
          return (
            <span className="absolute -translate-x-1/2 rounded-md bg-panel-solid px-1.5 py-0.5 text-[10px] font-semibold text-ink shadow ring-1 ring-line-strong" style={{ left: p.x, top: p.y - 26 }}>
              {selBird.p.id}
            </span>
          );
        })()}
        {tip && (
          <span className="absolute rounded-md bg-ink/90 px-2 py-1 text-[11px] text-white shadow" style={{ left: tip.x + 12, top: tip.y + 12 }}>
            {tip.text}
          </span>
        )}
        <div className={cx("absolute inset-0 grid place-items-center bg-ink/25 text-sm font-medium text-white transition-opacity", hint ? "opacity-100" : "opacity-0")}>Use Ctrl + scroll to zoom the map</div>
      </div>

      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl border border-line-strong bg-panel-solid/90 shadow-sm backdrop-blur">
        <button onClick={() => zoomAt(1.4)} className="grid h-9 w-9 place-items-center text-muted hover:bg-ink/5 hover:text-ink" aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button onClick={() => zoomAt(1 / 1.4)} className="grid h-9 w-9 place-items-center border-t border-line text-muted hover:bg-ink/5 hover:text-ink" aria-label="Zoom out">
          <Minus size={16} />
        </button>
        <button onClick={() => setView(fit())} className="grid h-9 w-9 place-items-center border-t border-line text-muted hover:bg-ink/5 hover:text-ink" aria-label="Reset view">
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-panel-solid/85 px-2 py-1 text-[10px] text-muted shadow-sm backdrop-blur">
        <ImageIcon size={12} /> Reference render · positions approximate · drag to pan · Ctrl + scroll to zoom
      </div>
    </div>
  );
}

/** The dots, memoised so panning does not redraw 500 markers. */
const BirdDots = memo(function BirdDots({ dots, k, selectedId, smooth, onBird, onTip }: {
  dots: { p: ScenePoint; u: number; v: number }[];
  k: number;
  selectedId: string | null;
  smooth: boolean;
  onBird: (id: string) => void;
  onTip: (t: { x: number; y: number; text: string } | null) => void;
}) {
  return (
    <g>
      {dots.map(({ p, u, v }) => {
        const sel = p.id === selectedId;
        const r = (sel ? DOT * 1.6 : p.dim ? DOT * 0.75 : DOT) / k;
        return (
          <g
            key={p.id}
            style={{ transform: `translate(${u}px, ${v}px)`, transition: smooth ? "transform 480ms linear" : undefined }}
            className="cursor-pointer"
            opacity={p.dim ? 0.25 : 1}
            onClick={(e) => (e.stopPropagation(), onBird(p.id))}
            onMouseMove={(e) => onTip({ x: e.clientX, y: e.clientY, text: p.label })}
            onMouseLeave={() => onTip(null)}
          >
            {sel && <circle r={r + 5 / k} fill="none" stroke="#0b2440" strokeWidth={2 / k} />}
            <circle r={r + 1.2 / k} fill="rgba(3,16,28,0.55)" />
            <circle r={r} fill={p.color} stroke="#ffffff" strokeWidth={1.4 / k} />
          </g>
        );
      })}
    </g>
  );
});
