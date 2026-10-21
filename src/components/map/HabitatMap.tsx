"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DoorOpen, Droplet, Locate, Minus, Plus, ScanLine, Snowflake, Waves, Scale, Maximize2 } from "lucide-react";
import { HABITAT } from "@/domain/habitat";
import type { HabitatZone, Medium, ReadingQuality } from "@/domain/types";
import { bbox, centroid, smoothPath } from "@/logic/geometry";
import type { LiveStatus } from "@/logic/status";
import { tessellateZones } from "@/logic/tessellation";

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
}

export interface MapLayers {
  zones: boolean;
  labels: boolean;
  landmarks: boolean;
  markers: boolean;
  lastKnown: boolean;
  restricted: boolean;
  trail: boolean;
}

export const DEFAULT_LAYERS: MapLayers = { zones: true, labels: true, landmarks: true, markers: true, lastKnown: true, restricted: true, trail: true };

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL: View = { x: 0, y: 0, w: HABITAT.width, h: HABITAT.height };

/** Superficie de cada zona de tierra: nieve, roca o grava. Sin entrada, usa la de su tipo. */
const ZONE_SURFACE: Record<string, { fill: string; texture?: string }> = {
  "snow-beach": { fill: "url(#snow-fill)", texture: "url(#snow-tex)" },
  "ice-ridge": { fill: "url(#snow-fill)", texture: "url(#snow-tex)" },
  "nesting-rocks": { fill: "url(#rock-fill)", texture: "url(#rock-tex)" },
  "pebble-beach": { fill: "url(#sand-fill)", texture: "url(#pebble-tex)" },
  "observation-ledge": { fill: "url(#rock-fill)", texture: "url(#rock-tex)" },
};

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
  /** Transición suave al cambiar de posición (desactivar mientras se reproduce cuadro a cuadro). */
  animate?: boolean;
  focus?: { key: number; x: number; y: number; w?: number } | null;
  overlay?: ReactNode;
  /** Tamaño relativo de las etiquetas de zona (los mapas pequeños las agrandan). */
  labelScale?: number;
  /** Botones de acercar/alejar y barra de escala. */
  showControls?: boolean;
  /** Puntos más grandes con un pingüino dentro (p. ej. al filtrar por equipo). */
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
    // Centrar en el foco pedido por la página (ejemplar o zona).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(clampView({ x: focus.x - w / 2, y: focus.y - h / 2, w, h }));
  }, [focus]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      // En mapas incrustados la rueda sigue desplazando la página; con Ctrl acerca.
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
  const ordered = useMemo(() => [...markers].sort((a, b) => Number(!a.dim) - Number(!b.dim)), [markers]);

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
          <linearGradient id="floor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1b4a42" />
            <stop offset="55%" stopColor="#173f3a" />
            <stop offset="100%" stopColor="#133632" />
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
          {/* Vegetación entre zonas: une las áreas y evita huecos vacíos. */}
          <pattern id="foliage" width="46" height="46" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="10" r="7" fill="rgba(52,120,86,0.35)" />
            <circle cx="30" cy="6" r="5" fill="rgba(70,140,96,0.28)" />
            <circle cx="22" cy="30" r="8" fill="rgba(40,104,76,0.32)" />
            <circle cx="42" cy="38" r="5" fill="rgba(62,132,90,0.25)" />
            <circle cx="6" cy="40" r="4" fill="rgba(86,152,104,0.22)" />
          </pattern>
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
          <pattern id="grid" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M200 0H0V200" fill="none" stroke="rgba(148,197,233,0.05)" strokeWidth="1" />
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
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <rect x="20" y="20" width={HABITAT.width - 40} height={HABITAT.height - 40} rx="48" fill="url(#floor)" stroke="rgba(148,197,233,0.12)" strokeWidth="2" />
        <rect x="20" y="20" width={HABITAT.width - 40} height={HABITAT.height - 40} rx="48" fill="url(#foliage)" />
        {/* El terreno sigue fuera del plano para que el mapa no deje bandas vacías en pantallas anchas. */}
        {["#163a35", "url(#foliage)"].map((fill) => (
          <path
            key={fill}
            d={`M-4000 -4000H${HABITAT.width + 4000}V${HABITAT.height + 4000}H-4000Z M20 68 V${HABITAT.height - 68} Q20 ${HABITAT.height - 20} 68 ${HABITAT.height - 20} H${HABITAT.width - 68} Q${HABITAT.width - 20} ${HABITAT.height - 20} ${HABITAT.width - 20} ${HABITAT.height - 68} V68 Q${HABITAT.width - 20} 20 ${HABITAT.width - 68} 20 H68 Q20 20 20 68Z`}
            fillRule="evenodd"
            fill={fill}
            pointerEvents="none"
          />
        ))}
        <rect x="20" y="20" width={HABITAT.width - 40} height={HABITAT.height - 40} rx="48" fill="url(#grid)" />
        {/* Las zonas se reparten todo el recinto y se tocan entre sí: sin huecos. */}
        {layers.zones && (
          <g clipPath="url(#habitat-clip)">
            {zones.map(({ zone, path }) => {
              if (zone.restricted && !layers.restricted) return null;
              const st = ZONE_STYLE[zone.restricted ? "restricted" : zone.kind];
              const surface = zone.restricted ? undefined : ZONE_SURFACE[zone.id];
              const count = zoneCounts?.get(zone.id) ?? 0;
              return (
                <g key={zone.id} data-zone={zone.id} onPointerEnter={() => setHover(`z:${zone.id}`)} onPointerLeave={() => setHover(null)} className={onZoneClick ? "cursor-pointer" : ""}>
                  {/* El trazo del mismo color tapa las rendijas donde se juntan tres zonas. */}
                  <path d={path} fill={surface?.fill ?? st.fill} stroke={surface?.fill ?? st.fill} strokeWidth={10} strokeLinejoin="round" />
                  {surface?.texture && <path d={path} fill={surface.texture} pointerEvents="none" />}
                  {zone.kind === "water" && <path d={path} fill="url(#ripples)" pointerEvents="none" />}
                  {heat && count > 0 && <path d={path} fill="var(--accent)" opacity={0.04 + (count / maxCount) * 0.26} pointerEvents="none" />}
                </g>
              );
            })}
            {/* Bordes compartidos: orilla de arena en el agua, línea fina entre zonas de tierra. */}
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
            const sub = showCount ? `${count} ${count === 1 ? "ejemplar" : "ejemplares"}` : "";
            // Etiqueta en cápsula oscura: se lee igual sobre agua, nieve o roca.
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
          <g pointerEvents="none">
            <polyline
              points={trail.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="rgba(47,216,200,0.45)"
              strokeWidth={1.6 * k}
              strokeDasharray={`${5 * k} ${5 * k}`}
            />
            {trail.map((p, i) => (
              <circle
                key={p.t}
                cx={p.x}
                cy={p.y}
                r={(2.2 + (i / trail.length) * 2.6) * k}
                fill={p.medium === "water" ? "#4fb3ff" : "#cfe3f1"}
                opacity={0.25 + (i / trail.length) * 0.75}
                stroke="#03101c"
                strokeWidth={0.8 * k}
              />
            ))}
          </g>
        )}

        {layers.markers &&
          ordered.map((m) => {
            const lastKnown = m.status === "stale" || m.status === "offline";
            if (lastKnown && !layers.lastKnown) return null;
            const r = (penguinMarkers ? 13 : 8) * Math.max(k, 0.4);
            const isSel = m.id === selectedId;
            const hv = hover === m.id;
            return (
              <g
                key={m.id}
                data-marker={m.dim ? undefined : m.id}
                style={{
                  transform: `translate(${m.x}px, ${m.y}px)`,
                  transition: animate ? "transform 700ms cubic-bezier(0.33, 0, 0.2, 1)" : undefined,
                }}
                opacity={m.dim ? 0.13 : 1}
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
                {lastKnown ? (
                  <>
                    <circle r={r} fill="rgba(3,16,28,0.85)" stroke={m.status === "offline" ? "#ff6b6b" : m.color} strokeWidth={2 * Math.max(k, 0.5)} strokeDasharray={`${3 * Math.max(k, 0.5)} ${2.5 * Math.max(k, 0.5)}`} />
                    {penguinMarkers ? <PenguinGlyph s={r * 0.82} faded /> : <circle r={r * 0.35} fill={m.status === "offline" ? "#ff6b6b" : m.color} opacity={0.8} />}
                  </>
                ) : (
                  <>
                    {m.medium === "water" && <circle r={r * 1.55} fill="none" stroke="rgba(92,184,255,0.55)" strokeWidth={1.2 * Math.max(k, 0.5)} />}
                    <circle r={r} fill={m.color} stroke="#03101c" strokeWidth={1.8 * Math.max(k, 0.5)} />
                    {penguinMarkers && <PenguinGlyph s={r * 0.82} />}
                    {m.status === "resting" &&
                      (penguinMarkers ? (
                        <circle cx={r * 0.72} cy={-r * 0.72} r={r * 0.26} fill="#03101c" stroke={m.color} strokeWidth={1.2 * Math.max(k, 0.5)} />
                      ) : (
                        <circle r={r * 0.32} fill="#03101c" opacity={0.6} />
                      ))}
                  </>
                )}
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
      </svg>

      {interactive && showControls && (
        <div className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-xl border border-line-strong bg-panel-solid/90 backdrop-blur">
          <MapBtn label="Acercar" onClick={() => zoomAt(1 / 1.4)}>
            <Plus size={15} />
          </MapBtn>
          <MapBtn label="Alejar" onClick={() => zoomAt(1.4)}>
            <Minus size={15} />
          </MapBtn>
          <MapBtn label="Ver todo el hábitat" onClick={() => setView(FULL)}>
            <Maximize2 size={14} />
          </MapBtn>
          {selected && (
            <MapBtn
              label="Centrar en el seleccionado"
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
  // 5 m en unidades del plano, expresado como fracción del ancho visible.
  const meters = k > 0.6 ? 5 : k > 0.3 ? 2 : 1;
  const pct = ((meters * HABITAT.unitsPerMeter) / (HABITAT.width * k)) * 100;
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 hidden text-[10px] text-muted sm:block">
      <div className="h-1.5 border-x border-b border-muted/60" style={{ width: `${pct}vw`, maxWidth: 160 }} />
      <span>{meters} m · plano de referencia</span>
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

/** Pingüino dibujado dentro del punto; `s` es su medio alto. */
function PenguinGlyph({ s, faded }: { s: number; faded?: boolean }) {
  return (
    <g transform={`scale(${s})`} opacity={faded ? 0.75 : 1} pointerEvents="none">
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
