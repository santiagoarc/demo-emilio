"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DoorOpen, Droplet, Locate, Minus, Plus, ScanLine, Snowflake, Waves, Scale, Maximize2 } from "lucide-react";
import { HABITAT } from "@/domain/habitat";
import type { HabitatZone, Medium, ReadingQuality } from "@/domain/types";
import { bbox, centroid, pointInPolygon, smoothPath } from "@/logic/geometry";
import type { LiveStatus } from "@/logic/status";
import { tessellateZones } from "@/logic/tessellation";
import { hideTip, showTip } from "@/components/charts/Charts";

export interface MapMarker {
  id: string;
  x: number;
  y: number;
  color: string;
  status: LiveStatus;
  medium: Medium;
  accuracyM: number;
  dim?: boolean;
}

export interface TrailPoint {
  x: number;
  y: number;
  t: number;
  quality: ReadingQuality;
  medium: Medium;
  /** Zone of the reading: consecutive readings in the same zone form one stop. */
  zoneId?: string;
}

interface TrailStop {
  n: number;
  x: number;
  y: number;
  from: number;
  to: number;
  zoneId?: string;
  medium: Medium;
  readings: number;
}

/** Groups consecutive readings in the same zone (or very close together, if there is no zone) into numbered stops. */
function trailStops(trail: TrailPoint[]): TrailStop[] {
  const stops: TrailStop[] = [];
  for (const p of trail) {
    const last = stops[stops.length - 1];
    const same = last && (p.zoneId !== undefined ? p.zoneId === last.zoneId : Math.hypot(p.x - last.x, p.y - last.y) < 40);
    if (same) {
      last.to = p.t;
      last.readings++;
      // The stop is drawn where the bird ended up.
      last.x = p.x;
      last.y = p.y;
    } else {
      stops.push({ n: stops.length + 1, x: p.x, y: p.y, from: p.t, to: p.t, zoneId: p.zoneId, medium: p.medium, readings: 1 });
    }
  }
  return stops;
}

const stopTime = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export interface MapLayers {
  zones: boolean;
  labels: boolean;
  landmarks: boolean;
  markers: boolean;
  restricted: boolean;
  trail: boolean;
}

export const DEFAULT_LAYERS: MapLayers = { zones: true, labels: true, landmarks: true, markers: true, restricted: true, trail: true };

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL: View = { x: 0, y: 0, w: HABITAT.width, h: HABITAT.height };

/** Surface of each land zone: snow, rock or pebbles. Without an entry, the zone kind's default is used. */
const ZONE_SURFACE: Record<string, { fill: string; texture?: string }> = {
  "snow-beach": { fill: "url(#snow-fill)", texture: "url(#snow-tex)" },
  "ice-ridge": { fill: "url(#snow-fill)", texture: "url(#snow-tex)" },
  "nesting-rocks": { fill: "url(#rock-fill)", texture: "url(#rock-tex)" },
  "pebble-beach": { fill: "url(#sand-fill)", texture: "url(#pebble-tex)" },
  "observation-ledge": { fill: "url(#rock-fill)", texture: "url(#rock-tex)" },
};

/** How far a penguin drifts from its last reading in live mode (layout units; 40 u = 1 m). */
const LIVE_RADIUS: Partial<Record<LiveStatus, number>> = { water: 120, land: 34 };
const LIVE_TICK_MS = 400;
/** Share of penguins on land that pick a new destination each tick: they walk now and then. */
const LIVE_SHARE = 0.3;
const LIVE_STEP_MS = 2600;
/** Swim leg: on reaching a point they pick the next one, so they never stop in the water. */
const SWIM_STEP_MS = 1500;
/** Ground color around the zones. */
export const MAP_BG = "#ece2cd";

/**
 * Simulated drift around the last reading: each penguin in water or on land
 * wanders without leaving its zone. Resting birds stay put.
 */
function useLiveDrift(markers: MapMarker[], live: boolean) {
  const [offsets, setOffsets] = useState<Map<string, [number, number]>>(() => new Map());
  const latest = useRef(markers);
  const swimUntil = useRef(new Map<string, number>());
  useEffect(() => {
    latest.current = markers;
  }, [markers]);

  useEffect(() => {
    if (!live || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOffsets(new Map());
      return;
    }
    const zoneOf = new Map<string, HabitatZone | undefined>();
    const swim = swimUntil.current;
    const step = () => {
      const now = Date.now();
      setOffsets((prev) => {
        const next = new Map(prev);
        for (const m of latest.current) {
          const radius = LIVE_RADIUS[m.status];
          if (!radius || m.dim) continue;
          if (m.status === "water") {
            if ((swim.get(m.id) ?? 0) > now) continue;
            swim.set(m.id, now + SWIM_STEP_MS - LIVE_TICK_MS / 2);
          } else if (Math.random() > LIVE_SHARE) continue;
          const key = `${m.id}@${m.x},${m.y}`;
          if (!zoneOf.has(key)) zoneOf.set(key, HABITAT.zones.find((z) => pointInPolygon(m.x, m.y, z.polygon)));
          const zone = zoneOf.get(key);
          for (let i = 0; i < 4; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = radius * Math.sqrt(Math.random());
            const dx = Math.cos(a) * d;
            const dy = Math.sin(a) * d;
            if (!zone || pointInPolygon(m.x + dx, m.y + dy, zone.polygon)) {
              next.set(m.id, [dx, dy]);
              break;
            }
          }
        }
        return next;
      });
    };
    step();
    const id = setInterval(step, LIVE_TICK_MS);
    return () => {
      clearInterval(id);
      swim.clear();
    };
  }, [live]);

  return offsets;
}

const ZONE_STYLE: Record<HabitatZone["kind"], { fill: string; stroke: string; dash?: string }> = {
  water: { fill: "url(#water-fill)", stroke: "rgba(92,184,255,0.45)" },
  land: { fill: "url(#land-fill)", stroke: "rgba(205,231,247,0.20)" },
  feeding: { fill: "url(#sand-fill)", stroke: "rgba(47,216,200,0.6)", dash: "6 5" },
  care: { fill: "url(#care-fill)", stroke: "rgba(167,139,250,0.55)", dash: "6 5" },
  restricted: { fill: "url(#hatch)", stroke: "rgba(255,107,107,0.45)", dash: "3 4" },
};

export function HabitatMap({
  markers,
  selectedId,
  onSelect,
  selectedZones = [],
  onZoneClick,
  zoneCounts,
  heat,
  trail,
  layers = DEFAULT_LAYERS,
  interactive = true,
  wheelZoom = false,
  animate = false,
  live = false,
  focus,
  overlay,
  labelScale = 1,
  showControls = true,
  penguinMarkers = false,
  className,
}: {
  markers: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  selectedZones?: string[];
  onZoneClick?: (zoneId: string) => void;
  zoneCounts?: Map<string, number>;
  heat?: boolean;
  trail?: TrailPoint[];
  layers?: MapLayers;
  interactive?: boolean;
  wheelZoom?: boolean;
  /** Smooth transition when the position changes (disable during frame-by-frame playback). */
  animate?: boolean;
  /** Penguins move around their last reading, like a live view. */
  live?: boolean;
  focus?: { key: number; x: number; y: number; w?: number } | null;
  overlay?: ReactNode;
  /** Relative size of zone labels (small maps enlarge them). */
  labelScale?: number;
  /** Zoom in/out buttons and scale bar. */
  showControls?: boolean;
  /** Larger dots with a penguin inside (e.g. when filtering by team). */
  penguinMarkers?: boolean;
  className?: string;
}) {
  const [view, setView] = useState<View>(FULL);
  const [hover, setHover] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const k = view.w / HABITAT.width;

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const w = Math.min(FULL.w, Math.max(FULL.w / 8, v.w * factor));
      const h = (w / FULL.w) * FULL.h;
      const px = cx ?? v.x + v.w / 2;
      const py = cy ?? v.y + v.h / 2;
      const rx = (px - v.x) / v.w;
      const ry = (py - v.y) / v.h;
      return clampView({ x: px - rx * w, y: py - ry * h, w, h });
    });
  }, []);

  useEffect(() => {
    if (!focus) return;
    const w = focus.w ?? FULL.w / 2.6;
    const h = (w / FULL.w) * FULL.h;
    // Center on the focus requested by the page (penguin or zone).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(clampView({ x: focus.x - w / 2, y: focus.y - h / 2, w, h }));
  }, [focus]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      // On embedded maps the wheel keeps scrolling the page; Ctrl+wheel zooms.
      if (!wheelZoom && !e.ctrlKey) return;
      e.preventDefault();
      const p = toSvg(el, e.clientX, e.clientY);
      zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [interactive, wheelZoom, zoomAt]);

  const zones = useMemo(() => {
    const regions = tessellateZones(HABITAT.zones, { x: 20, y: 20, w: HABITAT.width - 40, h: HABITAT.height - 40 });
    return HABITAT.zones.map((z) => {
        const c = centroid(z.polygon);
        const b = bbox(z.polygon);
        return { zone: z, path: regions.get(z.id) || smoothPath(z.polygon), cx: c[0], cy: z.kind === "restricted" || z.id === "vet-holding" ? c[1] : b.minY + b.h * 0.3 };
    });
  }, []);
  const maxCount = Math.max(1, ...(zoneCounts ? [...zoneCounts.values()] : [1]));
  const selected = markers.find((m) => m.id === selectedId);
  // Dimmed markers at the bottom, the selected one on top.
  const ordered = useMemo(
    () => [...markers].sort((a, b) => Number(!a.dim) - Number(!b.dim) || Number(a.id === selectedId) - Number(b.id === selectedId)),
    [markers, selectedId],
  );
  // With a penguin selected, the others blur and its stops are numbered.
  const focusOn = !!selectedId && markers.some((m) => m.id === selectedId);
  const stops = useMemo(() => (trail?.length ? trailStops(trail) : []), [trail]);
  const drift = useLiveDrift(markers, live);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ""}`}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        className={`h-full w-full touch-none select-none ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
        onPointerDown={(e) => {
          if (interactive) (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !svgRef.current || !interactive) return;
          const rect = svgRef.current.getBoundingClientRect();
          const scale = Math.max(view.w / rect.width, view.h / rect.height);
          const dx = (e.clientX - d.x) * scale;
          const dy = (e.clientY - d.y) * scale;
          if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true;
          if (d.moved) setView((v) => clampView({ ...v, x: d.vx - dx, y: d.vy - dy }));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) {
            const target = (e.target as Element).closest("[data-marker],[data-zone]");
            if (target?.getAttribute("data-marker")) onSelect?.(target.getAttribute("data-marker"));
            else if (target?.getAttribute("data-zone")) onZoneClick?.(target.getAttribute("data-zone")!);
            else onSelect?.(null);
          }
        }}
      >
        <defs>
          <radialGradient id="water-fill" cx="45%" cy="40%" r="75%">
            <stop offset="0%" stopColor="#13618f" />
            <stop offset="70%" stopColor="#0c4369" />
            <stop offset="100%" stopColor="#0a3555" />
          </radialGradient>
          <linearGradient id="land-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1f3d5c" />
            <stop offset="100%" stopColor="#172f48" />
          </linearGradient>
          <linearGradient id="snow-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7fa9c6" />
            <stop offset="100%" stopColor="#5a87a8" />
          </linearGradient>
          <linearGradient id="rock-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4d5156" />
            <stop offset="100%" stopColor="#3b3f45" />
          </linearGradient>
          <linearGradient id="sand-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8a7552" />
            <stop offset="100%" stopColor="#6e5c40" />
          </linearGradient>
          <linearGradient id="care-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3a3f6a" />
            <stop offset="100%" stopColor="#2d3256" />
          </linearGradient>
          <pattern id="snow-tex" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="6" r="1.6" fill="rgba(255,255,255,0.35)" />
            <circle cx="19" cy="15" r="1.2" fill="rgba(255,255,255,0.3)" />
            <circle cx="10" cy="23" r="1" fill="rgba(255,255,255,0.25)" />
          </pattern>
          <pattern id="rock-tex" width="34" height="34" patternUnits="userSpaceOnUse">
            <ellipse cx="9" cy="9" rx="6" ry="4" fill="rgba(140,140,132,0.22)" />
            <ellipse cx="25" cy="22" rx="7" ry="5" fill="rgba(20,22,26,0.25)" />
            <ellipse cx="8" cy="27" rx="4" ry="3" fill="rgba(160,156,146,0.18)" />
          </pattern>
          <pattern id="pebble-tex" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="2" fill="rgba(230,214,180,0.22)" />
            <circle cx="15" cy="12" r="2.4" fill="rgba(60,46,30,0.22)" />
            <circle cx="8" cy="17" r="1.6" fill="rgba(230,214,180,0.18)" />
          </pattern>
          <pattern id="ripples" width="120" height="60" patternUnits="userSpaceOnUse">
            <path d="M0 30 Q 15 22 30 30 T 60 30 T 90 30 T 120 30" fill="none" stroke="rgba(160,215,255,0.07)" strokeWidth="2" />
          </pattern>
          <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="10" height="10" fill="rgba(255,107,107,0.05)" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,107,107,0.28)" strokeWidth="2" />
          </pattern>
          <clipPath id="habitat-clip">
            <rect x="20" y="20" width={HABITAT.width - 40} height={HABITAT.height - 40} rx="48" />
          </clipPath>
          <filter id="blur-others" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Solid background; extends past the layout so wide screens show no bands. */}
        <rect x={-4000} y={-4000} width={HABITAT.width + 8000} height={HABITAT.height + 8000} fill={MAP_BG} pointerEvents="none" />
        {/* Zones split the whole enclosure and touch each other: no gaps. */}
        {layers.zones && (
          <g clipPath="url(#habitat-clip)">
            {zones.map(({ zone, path }) => {
              if (zone.restricted && !layers.restricted) return null;
              const st = ZONE_STYLE[zone.restricted ? "restricted" : zone.kind];
              const surface = zone.restricted ? undefined : ZONE_SURFACE[zone.id];
              const count = zoneCounts?.get(zone.id) ?? 0;
              return (
                <g key={zone.id} data-zone={zone.id} onPointerEnter={() => setHover(`z:${zone.id}`)} onPointerLeave={() => setHover(null)} className={onZoneClick ? "cursor-pointer" : ""}>
                  {/* A same-color stroke hides the slivers where three zones meet. */}
                  <path d={path} fill={surface?.fill ?? st.fill} stroke={surface?.fill ?? st.fill} strokeWidth={10} strokeLinejoin="round" />
                  {surface?.texture && <path d={path} fill={surface.texture} pointerEvents="none" />}
                  {zone.kind === "water" && <path d={path} fill="url(#ripples)" pointerEvents="none" />}
                  {heat && count > 0 && <path d={path} fill="var(--accent)" opacity={0.04 + (count / maxCount) * 0.26} pointerEvents="none" />}
                </g>
              );
            })}
            {/* Shared borders: a sandy shoreline at the water, a thin line between land zones. */}
            {zones.map(({ zone, path }) =>
              zone.restricted && !layers.restricted ? null : (
                <path
                  key={`edge-${zone.id}`}
                  d={path}
                  fill="none"
                  stroke={zone.medium === "water" ? "rgba(214,192,140,0.75)" : zone.restricted ? "rgba(255,107,107,0.45)" : "rgba(6,24,30,0.55)"}
                  strokeWidth={zone.medium === "water" ? 9 : 2.5}
                  strokeDasharray={zone.restricted ? "6 5" : undefined}
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              ),
            )}
            {zones.map(({ zone, path }) => {
              const on = selectedZones.includes(zone.id);
              const hv = hover === `z:${zone.id}`;
              if (!on && !hv) return null;
              return (
                <g key={`sel-${zone.id}`} pointerEvents="none">
                  {on && <path d={path} fill="none" stroke="var(--accent)" strokeWidth={10} opacity={0.35} filter="url(#glow)" />}
                  <path d={path} fill="none" stroke={on ? "var(--accent)" : "rgba(205,231,247,0.55)"} strokeWidth={on ? 3.5 : 2} strokeLinejoin="round" />
                </g>
              );
            })}
          </g>
        )}

        {layers.landmarks &&
          HABITAT.landmarks.map((l) => (
            <g key={l.id} transform={`translate(${l.x},${l.y}) scale(${Math.max(k, 0.45)})`} pointerEvents="none" opacity={0.85}>
              <circle r="15" fill="#0a1d31" stroke="rgba(205,231,247,0.35)" />
              <LandmarkIcon kind={l.icon} />
              {layers.labels && k > 0.5 && (
                <text y="30" textAnchor="middle" fontSize="13" fill="rgba(205,231,247,0.55)">
                  {l.name}
                </text>
              )}
            </g>
          ))}

        {layers.zones &&
          layers.labels &&
          zones.map(({ zone, cx, cy }) => {
            if (zone.restricted && !layers.restricted) return null;
            const count = zoneCounts?.get(zone.id);
            const showCount = count !== undefined && zone.kind !== "restricted";
            const fs = Math.max(15 * k * labelScale, 9);
            const sub = showCount ? `${count} ${count === 1 ? "penguin" : "penguins"}` : "";
            // Label in a dark capsule: reads the same over water, snow or rock.
            const w = Math.max(zone.name.length * fs * 0.56, sub.length * fs * 0.5) + fs * 1.4;
            const h = showCount ? fs * 2.75 : fs * 1.75;
            return (
              <g key={`lbl-${zone.id}`} pointerEvents="none" transform={`translate(${cx},${cy})`}>
                <rect x={-w / 2} y={-fs * 1.25} width={w} height={h} rx={fs * 0.45} fill="rgba(4,18,32,0.78)" stroke="rgba(205,231,247,0.22)" strokeWidth={Math.max(k, 0.5)} />
                <text y={0} textAnchor="middle" fontSize={fs} fontWeight={600} fill="#e6f2fb">
                  {zone.name}
                </text>
                {showCount && (
                  <text y={fs * 1.1} textAnchor="middle" fontSize={fs * 0.82} fill="rgba(170,205,230,0.9)" className="num">
                    {sub}
                  </text>
                )}
              </g>
            );
          })}

        {layers.trail && trail && trail.length > 0 && (
          <g pointerEvents="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Light outline under the line so it stands out over water and sand. */}
            <polyline points={trail.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={8 * k} />
            {/* Segment by segment: oldest (light) to most recent (strong). */}
            {trail.slice(1).map((p, i) => {
              const a = trail[i];
              const f = (i + 1) / trail.length;
              return <line key={p.t} x1={a.x} y1={a.y} x2={p.x} y2={p.y} stroke="#0b6f68" strokeOpacity={0.35 + f * 0.65} strokeWidth={(3 + f * 2.2) * k} />;
            })}
            {/* Direction arrows midway along some segments. */}
            {trail.slice(1).map((p, i) => {
              const a = trail[i];
              const len = Math.hypot(p.x - a.x, p.y - a.y);
              if (len < 30 * k || i % 2) return null;
              const ang = (Math.atan2(p.y - a.y, p.x - a.x) * 180) / Math.PI;
              const s = 6 * k;
              return (
                <path
                  key={`arr-${p.t}`}
                  d={`M${-s} ${-s * 0.8} L${s} 0 L${-s} ${s * 0.8}`}
                  transform={`translate(${(a.x + p.x) / 2},${(a.y + p.y) / 2}) rotate(${ang})`}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={2.2 * k}
                />
              );
            })}
            {trail.map((p, i) => (
              <circle
                key={p.t}
                cx={p.x}
                cy={p.y}
                r={(3.2 + (i / trail.length) * 2.8) * k}
                fill={p.medium === "water" ? "#2b7fd0" : "#d4920f"}
                opacity={0.55 + (i / trail.length) * 0.45}
                stroke="#ffffff"
                strokeWidth={1.4 * k}
              />
            ))}
            {/* Start of the path. */}
            <circle cx={trail[0].x} cy={trail[0].y} r={7 * k} fill="none" stroke="#0b6f68" strokeWidth={2 * k} strokeDasharray={`${3 * k} ${2 * k}`} />
          </g>
        )}

        {layers.markers &&
          ordered.map((m) => {
            const isSel = m.id === selectedId;
            // The selected marker is always a penguin glyph; with a filter or status chosen, so are the matches.
            const asPenguin = isSel || (penguinMarkers && !m.dim);
            const r = (asPenguin ? 13 : 8) * Math.max(k, 0.4);
            const hv = hover === m.id;
            const [dx, dy] = drift.get(m.id) ?? [0, 0];
            return (
              <g
                key={m.id}
                data-marker={m.dim ? undefined : m.id}
                style={{
                  transform: `translate(${m.x + dx}px, ${m.y + dy}px)`,
                  transition: live
                    ? m.status === "water"
                      ? `transform ${SWIM_STEP_MS}ms linear`
                      : `transform ${LIVE_STEP_MS}ms cubic-bezier(0.45, 0, 0.55, 1)`
                    : animate
                      ? "transform 700ms cubic-bezier(0.33, 0, 0.2, 1)"
                      : undefined,
                }}
                opacity={m.dim ? 0.13 : focusOn && !isSel ? 0.35 : 1}
                filter={focusOn && !isSel ? "url(#blur-others)" : undefined}
                className={m.dim ? "" : "cursor-pointer"}
                onPointerEnter={() => !m.dim && setHover(m.id)}
                onPointerLeave={() => setHover(null)}
              >
                {isSel && (
                  <circle
                    r={Math.max(m.accuracyM * HABITAT.unitsPerMeter, 10 * k)}
                    fill="rgba(47,216,200,0.08)"
                    stroke="rgba(47,216,200,0.35)"
                    strokeDasharray={`${4 * k} ${4 * k}`}
                    pointerEvents="none"
                  />
                )}
                {isSel && <circle r={r * 1.2} fill="none" stroke="var(--accent)" strokeWidth={2 * k} className="pulse-ring" />}
                {m.medium === "water" && <circle r={r * 1.55} fill="none" stroke="rgba(92,184,255,0.55)" strokeWidth={1.2 * Math.max(k, 0.5)} />}
                <circle r={r} fill={m.color} stroke="#03101c" strokeWidth={1.8 * Math.max(k, 0.5)} />
                {asPenguin && <PenguinGlyph s={r * 0.82} />}
                {m.status === "resting" &&
                  (asPenguin ? (
                    <circle cx={r * 0.72} cy={-r * 0.72} r={r * 0.26} fill="#03101c" stroke={m.color} strokeWidth={1.2 * Math.max(k, 0.5)} />
                  ) : (
                    <circle r={r * 0.32} fill="#03101c" opacity={0.6} />
                  ))}
                {isSel && <circle r={r + 3 * k} fill="none" stroke="#e6f2fb" strokeWidth={2 * Math.max(k, 0.5)} />}
                {(isSel || hv) && (
                  <g transform={`translate(0,${-r - 8 * Math.max(k, 0.5)})`} pointerEvents="none">
                    <rect x={-34 * Math.max(k, 0.5)} y={-20 * Math.max(k, 0.5)} width={68 * Math.max(k, 0.5)} height={18 * Math.max(k, 0.5)} rx={6 * Math.max(k, 0.5)} fill="#06182a" stroke="rgba(205,231,247,0.3)" />
                    <text y={-7 * Math.max(k, 0.5)} textAnchor="middle" fontSize={11 * Math.max(k, 0.5)} fontWeight={600} fill="#e6f2fb" fontFamily="var(--font-geist-mono)">
                      {m.id}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

        {/* Numbered stops along the selected penguin's path (1 = oldest). */}
        {layers.trail && focusOn && stops.length > 1 && (
          <g>
            {stops.map((st) => {
              const z = Math.max(k, 0.5);
              const last = st.n === stops.length;
              const mins = Math.round((st.to - st.from) / 60_000) + 30;
              return (
                <g
                  key={st.n}
                  transform={`translate(${st.x + 11 * z},${st.y - 11 * z})`}
                  className="cursor-default"
                  onMouseMove={(e) =>
                    showTip(e, {
                      title: `Stop ${st.n}${last ? " · latest" : ""}`,
                      rows: [
                        { label: "Zone", value: st.zoneId ? (HABITAT.zones.find((zz) => zz.id === st.zoneId)?.name ?? st.zoneId) : "—" },
                        { color: st.medium === "water" ? "#2b7fd0" : "#d4920f", label: st.medium === "water" ? "In water" : "On land", value: `${stopTime.format(st.from)}–${stopTime.format(st.to)}` },
                        { label: "Duration", value: mins >= 60 ? `${(mins / 60).toFixed(1)} h` : `${mins} min` },
                      ],
                      note: `${st.readings} ${st.readings === 1 ? "reading" : "readings"}`,
                    })
                  }
                  onMouseLeave={hideTip}
                >
                  <circle r={9 * z} fill={last ? "#0b6f68" : "#ffffff"} stroke="#0b6f68" strokeWidth={2 * z} />
                  <text y={3.6 * z} textAnchor="middle" fontSize={10 * z} fontWeight={700} fill={last ? "#ffffff" : "#0b6f68"} fontFamily="var(--font-geist-sans)">
                    {st.n}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {interactive && showControls && (
        <div className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-xl border border-line-strong bg-panel-solid/90 backdrop-blur">
          <MapBtn label="Zoom in" onClick={() => zoomAt(1 / 1.4)}>
            <Plus size={15} />
          </MapBtn>
          <MapBtn label="Zoom out" onClick={() => zoomAt(1.4)}>
            <Minus size={15} />
          </MapBtn>
          <MapBtn label="Show the whole habitat" onClick={() => setView(FULL)}>
            <Maximize2 size={14} />
          </MapBtn>
          {selected && (
            <MapBtn
              label="Center on selected penguin"
              onClick={() => {
                const w = FULL.w / 3;
                const h = (w / FULL.w) * FULL.h;
                setView(clampView({ x: selected.x - w / 2, y: selected.y - h / 2, w, h }));
              }}
            >
              <Locate size={14} />
            </MapBtn>
          )}
        </div>
      )}
      {interactive && showControls && <ScaleBar k={k} />}
      {live && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#0b2440] shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e5484d] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#e5484d]" />
          </span>
          Live · simulated
        </div>
      )}
      {overlay}
    </div>
  );
}

function MapBtn({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="grid h-9 w-9 place-items-center border-b border-line text-muted transition last:border-0 hover:bg-white/5 hover:text-ink">
      {children}
    </button>
  );
}

function ScaleBar({ k }: { k: number }) {
  // 5 m in layout units, as a fraction of the visible width.
  const meters = k > 0.6 ? 5 : k > 0.3 ? 2 : 1;
  const pct = ((meters * HABITAT.unitsPerMeter) / (HABITAT.width * k)) * 100;
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 hidden text-[10px] text-muted sm:block">
      <div className="h-1.5 border-x border-b border-muted/60" style={{ width: `${pct}vw`, maxWidth: 160 }} />
      <span>{meters} m · reference layout</span>
    </div>
  );
}

function LandmarkIcon({ kind }: { kind: string }) {
  const props = { x: -8, y: -8, width: 16, height: 16, color: "rgba(205,231,247,0.8)", strokeWidth: 2 } as const;
  switch (kind) {
    case "gate":
      return <DoorOpen {...props} />;
    case "window":
      return <ScanLine {...props} />;
    case "waterfall":
      return <Waves {...props} />;
    case "ice":
      return <Snowflake {...props} />;
    case "station":
      return <Scale {...props} />;
    default:
      return <Droplet {...props} />;
  }
}

function clampView(v: View): View {
  const mx = v.w * 0.25;
  const my = v.h * 0.25;
  return {
    ...v,
    x: Math.min(Math.max(v.x, -mx), FULL.w - v.w + mx),
    y: Math.min(Math.max(v.y, -my), FULL.h - v.h + my),
  };
}

function toSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = pt.matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

/** Penguin drawn inside the dot; `s` is its half-height. */
function PenguinGlyph({ s }: { s: number }) {
  return (
    <g transform={`scale(${s})`} pointerEvents="none">
      <ellipse cx={-0.15} cy={0.84} rx={0.13} ry={0.06} fill="#f5a524" />
      <ellipse cx={0.15} cy={0.84} rx={0.13} ry={0.06} fill="#f5a524" />
      <path d="M0,-0.8 C0.4,-0.8 0.52,-0.32 0.5,0.1 C0.48,0.56 0.27,0.82 0,0.82 C-0.27,0.82 -0.48,0.56 -0.5,0.1 C-0.52,-0.32 -0.4,-0.8 0,-0.8Z" fill="#0b1a26" />
      <path d="M0,-0.36 C0.27,-0.36 0.34,-0.02 0.32,0.2 C0.3,0.52 0.16,0.7 0,0.7 C-0.16,0.7 -0.3,0.52 -0.32,0.2 C-0.34,-0.02 -0.27,-0.36 0,-0.36Z" fill="#f4f8fb" />
      <circle cx={-0.15} cy={-0.5} r={0.065} fill="#f4f8fb" />
      <circle cx={0.15} cy={-0.5} r={0.065} fill="#f4f8fb" />
      <path d="M-0.1,-0.4 L0.1,-0.4 L0,-0.27Z" fill="#f5a524" />
    </g>
  );
}
