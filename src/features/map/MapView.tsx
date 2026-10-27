"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, Filter, Layers, Pause, Play, Radio, Search, X, ZoomIn } from "lucide-react";
import { HABITAT, ZONE_BY_ID, ZONE_KIND_LABEL } from "@/domain/habitat";
import { SPECIES_BY_ID } from "@/domain/species";
import type { Penguin, SpeciesId } from "@/domain/types";
import { centroid, bbox } from "@/logic/geometry";
import { snapshotAt, STATUS_LABEL, type LiveStatus, type Snapshot } from "@/logic/status";
import { fmtDateTime, fmtTime, HOUR, MIN } from "@/logic/time";
import { lastIndexAtOrBefore } from "@/logic/status";
import { useDemo } from "@/state/DemoProvider";
import { DEFAULT_LAYERS, HabitatMap, type MapLayers, type MapMarker, type TrailPoint } from "@/components/map/HabitatMap";
import { GlobalFilters } from "@/components/filters/GlobalFilters";
import { PenguinPanel } from "@/components/penguin/PenguinPanel";
import { StatusPill, STATUS_COLOR } from "@/components/penguin/StatusPill";
import { Button, Segmented, cx } from "@/components/ui/primitives";

const LAYER_LABEL: Record<keyof MapLayers, string> = {
  zones: "Zonas del hábitat",
  labels: "Nombres y conteos",
  landmarks: "Puntos de referencia",
  markers: "Ejemplares",
  restricted: "Áreas restringidas",
  trail: "Recorrido del seleccionado",
};

export function MapView() {
  const params = useSearchParams();
  const { dataset, scoped, filters, setFilters, deviceById, config, now, teamOf } = useDemo();
  const slot = dataset.slotMinutes * MIN;
  const [selectedId, setSelectedId] = useState<string | null>(params.get("penguin"));
  // ?zone=ID abre la ficha de esa zona (p. ej. desde el Overview).
  const [zoneId, setZoneId] = useState<string | null>(() => {
    const z = params.get("zone");
    return z && ZONE_BY_ID[z] && !params.get("penguin") ? z : null;
  });
  // Abre en vivo (última lectura); el botón de reproducir recorre las últimas 24 h.
  const [at, setAt] = useState(now);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [smooth, setSmooth] = useState(true);
  const [loop, setLoop] = useState(true);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [showContext, setShowContext] = useState(true);
  const [focus, setFocus] = useState<{ key: number; x: number; y: number; w?: number } | null>(() => {
    // Si se llega con ?penguin=ID, el mapa abre centrado en ese ejemplar.
    const id = params.get("penguin");
    const list = id ? dataset.readings.get(id) : undefined;
    const r = list?.[lastIndexAtOrBefore(list, now)];
    if (r) return { key: 1, x: r.x, y: r.y, w: HABITAT.width / 2.2 };
    if (!zoneId) return null;
    const z = ZONE_BY_ID[zoneId];
    const b = bbox(z.polygon);
    const [cx, cy] = centroid(z.polygon);
    return { key: 1, x: cx, y: cy, w: Math.max(b.w * 1.8, (b.h * 1.8 * HABITAT.width) / HABITAT.height, 500) };
  });
  const live = at >= now;

  // ?species=ID y ?team=ID llegan desde Species y Care Teams: aplican ese filtro al abrir.
  const speciesParam = params.get("species");
  const teamParam = params.get("team");
  useEffect(() => {
    const patch: { species?: SpeciesId[]; teams?: string[] } = {};
    if (speciesParam && SPECIES_BY_ID[speciesParam as SpeciesId]) patch.species = [speciesParam as SpeciesId];
    if (teamParam && dataset.teams.some((t) => t.id === teamParam)) {
      patch.teams = [teamParam];
      if (!speciesParam) patch.species = [];
    }
    if (patch.species || patch.teams) setFilters(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speciesParam, teamParam]);

  // Reproducción continua: el reloj avanza cada cuadro, no a saltos de 30 min.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(t - last, 100);
      last = t;
      setAt((prev) => Math.min(now, prev + dt * (slot / 3000) * speed));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, slot, now, speed]);

  useEffect(() => {
    if (!playing || at < now) return;
    // Al llegar a "Ahora": en bucle, se queda un momento en la última lectura y
    // vuelve a empezar; sin bucle, se detiene.
    if (!loop) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setAt(now - 24 * HOUR), 2500);
    return () => window.clearTimeout(id);
  }, [playing, at, now, loop]);

  const scopedIds = useMemo(() => new Set(scoped.map((p) => p.id)), [scoped]);
  const snaps = useMemo(() => {
    const m = new Map<string, Snapshot>();
    for (const p of dataset.penguins) {
      if (!showContext && !scopedIds.has(p.id)) continue;
      m.set(p.id, snapshotAt(dataset, deviceById, config.rules, p, at));
    }
    return m;
  }, [dataset, deviceById, config.rules, at, scopedIds, showContext]);

  // Al picar "En agua", "En tierra" o "Sin movimiento" se resaltan solo esos.
  const [statusPick, setStatusPick] = useState<LiveStatus | null>(null);
  const inScope = (s: Snapshot) => scopedIds.has(s.penguin.id) && (!filters.zones.length || filters.zones.includes(s.reading?.zoneId ?? ""));
  const isActive = (s: Snapshot) => inScope(s) && (!statusPick || s.status === statusPick);
  // Con algo elegido (estado, especie, equipo, zona o un ejemplar), los que coinciden se ven como pingüino.
  const highlight = !!statusPick || filters.species.length > 0 || filters.teams.length > 0 || filters.zones.length > 0 || !!filters.penguinId;

  const markers: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = [];
    for (const s of snaps.values()) {
      if (!s.reading) continue;
      let x = s.reading.x;
      let y = s.reading.y;
      // Animación visual entre dos lecturas consecutivas.
      if (smooth && at < now) {
        const list = dataset.readings.get(s.penguin.id)!;
        const next = list[lastIndexAtOrBefore(list, at) + 1];
        if (next && next.timestamp > at && next.timestamp - s.reading.timestamp <= slot) {
          const f = (at - s.reading.timestamp) / (next.timestamp - s.reading.timestamp);
          const e = f * f * (3 - 2 * f);
          x += (next.x - x) * e;
          y += (next.y - y) * e;
        }
      }
      out.push({
        id: s.penguin.id,
        x,
        y,
        color: SPECIES_BY_ID[s.penguin.speciesId].color,
        status: s.status,
        medium: s.reading.medium,
        accuracyM: s.reading.accuracyM,
        dim: !isActive(s),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snaps, scopedIds, filters.zones, statusPick, smooth, at, now, slot, dataset]);

  const active = useMemo(() => [...snaps.values()].filter(isActive), [snaps, scopedIds, filters.zones, statusPick]); // eslint-disable-line react-hooks/exhaustive-deps
  // Los conteos por estado no dependen del estado elegido, para poder cambiar de uno a otro.
  const inScopeList = useMemo(() => [...snaps.values()].filter(inScope), [snaps, scopedIds, filters.zones]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoneCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of active) if (s.reading) m.set(s.reading.zoneId, (m.get(s.reading.zoneId) ?? 0) + 1);
    return m;
  }, [active]);
  const statusCounts = useMemo(() => {
    const c: Record<LiveStatus, number> = { water: 0, land: 0, resting: 0, stale: 0, offline: 0, no_data: 0 };
    for (const s of inScopeList) c[s.status]++;
    return c;
  }, [inScopeList]);

  const trail: TrailPoint[] | undefined = useMemo(() => {
    if (!selectedId) return undefined;
    const list = dataset.readings.get(selectedId) ?? [];
    const end = lastIndexAtOrBefore(list, at);
    const out: TrailPoint[] = [];
    for (let i = end; i >= 0 && list[i].timestamp > at - 6 * HOUR; i--) {
      const r = list[i];
      out.push({ x: r.x, y: r.y, t: r.timestamp, quality: r.quality, medium: r.medium, zoneId: r.zoneId });
    }
    return out.reverse();
  }, [selectedId, dataset, at]);

  const select = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      setZoneId(null);
    }
  };

  const zoneInfo = zoneId ? ZONE_BY_ID[zoneId] : null;
  const zonePenguins = zoneId ? active.filter((s) => s.reading?.zoneId === zoneId) : [];
  const total = scoped.length;
  const sliderMin = now - 24 * HOUR;

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col md:h-screen lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* El mapa ocupa todo su espacio: sin recuadros encima. */}
        <div className="relative min-h-[320px] flex-1">
          <HabitatMap
            markers={markers}
            selectedId={selectedId}
            onSelect={select}
            penguinMarkers={highlight}
            selectedZones={zoneId ? [...filters.zones, zoneId] : filters.zones}
            onZoneClick={(z) => {
              if (ZONE_BY_ID[z].kind === "restricted") return;
              // Un segundo clic en la misma zona la cierra.
              setZoneId(z === zoneId ? null : z);
              setSelectedId(null);
            }}
            zoneCounts={zoneCounts}
            trail={trail}
            layers={layers}
            focus={focus}
            wheelZoom
            animate={!playing}
            live={!playing && at >= now}
          />
        </div>

        {/* Línea de tiempo, debajo del mapa */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-panel-solid/80 px-4 py-3">
          <button
            onClick={() => {
              if (!playing && at >= now) setAt(sliderMin);
              setPlaying((v) => !v);
            }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white transition hover:bg-[#0b8178]"
            aria-label={playing ? "Pausar" : "Reproducir últimas 24 h"}
          >
            {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
          </button>
          <div className="min-w-[220px] flex-1">
            <div className="mb-0.5 flex flex-wrap items-center justify-between gap-x-3 text-[11px]">
              <span className="text-muted">
                {live ? (
                  <span className="inline-flex items-center gap-1.5 text-ok">
                    <Radio size={12} /> Última lectura simulada · {fmtTime(now)}
                  </span>
                ) : (
                  <>
                    Lecturas simuladas a las <span className="font-semibold text-ink">{fmtDateTime(at, now)}</span>
                  </>
                )}
              </span>
              <span className="text-faint">
                {smooth && !live ? "Desplazamiento animado entre lecturas · ayuda visual, no medición" : "Posiciones tal como se registraron"}
              </span>
            </div>
            <input
              type="range"
              className="timeline"
              min={sliderMin}
              max={now}
              step={MIN}
              value={at}
              style={{ ["--fill" as string]: `${((at - sliderMin) / (now - sliderMin)) * 100}%` }}
              onChange={(e) => {
                setPlaying(false);
                setAt(Number(e.target.value));
              }}
              aria-label="Hora de las lecturas"
            />
            <div className="flex justify-between text-[10px] text-faint">
              <span>{fmtDateTime(sliderMin, now)}</span>
              <span>{fmtTime(now - 12 * HOUR)}</span>
              <span>Ahora</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <Segmented<string>
                size="sm"
                value={String(speed)}
                onChange={(v) => setSpeed(Number(v))}
                options={[
                  { value: "1", label: "1×" },
                  { value: "4", label: "4×" },
                  { value: "12", label: "12×" },
                ]}
              />
              {!live && (
                <Button size="sm" variant="outline" onClick={() => (setPlaying(false), setAt(now))}>
                  Ahora
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
                <input type="checkbox" checked={loop} onChange={() => setLoop((v) => !v)} className="accent-[var(--accent)]" />
                Repetir
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
                <input type="checkbox" checked={smooth} onChange={() => setSmooth((v) => !v)} className="accent-[var(--accent)]" />
                Movimiento suave
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Columna derecha: conteos, capas, filtros y el detalle de lo seleccionado */}
      <aside className="flex max-h-[45vh] w-full shrink-0 flex-col border-t border-line bg-panel-solid/70 lg:max-h-none lg:w-[360px] lg:border-l lg:border-t-0">
        <div className="border-b border-line px-4 py-3">
          <p className="eyebrow">Habitat Map</p>
          <h1 className="text-lg font-semibold tracking-tight">{HABITAT.name.split(" · ")[0]}</h1>
          <PenguinSearch
            penguins={dataset.penguins}
            teamName={(id) => dataset.teams.find((t) => t.id === teamOf(id))?.name ?? ""}
            onPick={(id) => {
              select(id);
              const r = snaps.get(id)?.reading;
              if (r) setFocus({ key: Date.now(), x: r.x, y: r.y, w: 520 });
            }}
          />
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <MapStat label="En el mapa" value={inScopeList.filter((s) => s.reading).length} sub={`/ ${total}`} on={!statusPick} onClick={() => setStatusPick(null)} />
            {(["water", "land", "resting"] as LiveStatus[]).map((st) => (
              <MapStat
                key={st}
                label={st === "resting" ? "Sin movimiento" : STATUS_LABEL[st]}
                color={STATUS_COLOR[st]}
                value={statusCounts[st]}
                on={statusPick === st}
                onClick={() => setStatusPick(statusPick === st ? null : st)}
              />
            ))}
          </div>
        </div>

        {selectedId ? (
          <PenguinPanel
            penguinId={selectedId}
            at={at}
            onClose={() => setSelectedId(null)}
            className="min-h-0 flex-1 !w-full !max-w-none !rounded-none !border-0 !bg-none !shadow-none"
          />
        ) : zoneInfo ? (
          <div className="slide-in flex min-h-0 flex-1 flex-col">
            <div className="relative border-b border-line p-4">
              <button onClick={() => setZoneId(null)} className="absolute right-3 top-3 rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Cerrar">
                <X size={16} />
              </button>
              <p className="eyebrow">{ZONE_KIND_LABEL[zoneInfo.kind]}</p>
              <h2 className="mt-1 text-lg font-semibold">{zoneInfo.name}</h2>
              <p className="mt-1 text-xs text-muted">{zoneInfo.description}</p>
              <p className="mt-2 text-xs text-muted">
                Equipo responsable: <span className="text-ink">{dataset.teams.filter((t) => t.zoneIds.includes(zoneInfo.id)).map((t) => t.name).join(", ") || "—"}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant={filters.zones.includes(zoneInfo.id) ? "primary" : "outline"}
                  onClick={() =>
                    setFilters({ zones: filters.zones.includes(zoneInfo.id) ? filters.zones.filter((z) => z !== zoneInfo.id) : [...filters.zones, zoneInfo.id] })
                  }
                >
                  <Crosshair size={13} /> {filters.zones.includes(zoneInfo.id) ? "Quitar filtro" : "Filtrar por zona"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const b = bbox(zoneInfo.polygon);
                    const [cx, cy] = centroid(zoneInfo.polygon);
                    setFocus({ key: Date.now(), x: cx, y: cy, w: Math.max(b.w * 1.6, (b.h * 1.6 * HABITAT.width) / HABITAT.height, 300) });
                  }}
                >
                  <ZoomIn size={13} /> Acercar
                </Button>
              </div>
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto p-3">
              <p className="eyebrow mb-2 px-2">{zonePenguins.length} ejemplares registrados aquí</p>
              {zonePenguins.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">Ningún ejemplar con los filtros actuales tiene aquí su última ubicación.</p>}
              <ul>
                {zonePenguins.map((s) => (
                  <li key={s.penguin.id}>
                    <button onClick={() => select(s.penguin.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-ink/[0.04]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: SPECIES_BY_ID[s.penguin.speciesId].color }} />
                      <span className="w-[72px] font-mono text-xs">{s.penguin.id}</span>
                      <span className="flex-1 truncate text-[11px] text-faint">{dataset.teams.find((t) => t.id === teamOf(s.penguin.id))?.name}</span>
                      <StatusPill status={s.status} compact />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="scroll-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <div>
              <p className="eyebrow mb-2 flex items-center gap-1.5">
                <Filter size={12} /> Filtros
              </p>
              <GlobalFilters showRange={false} compact />
            </div>
            <div>
              <p className="eyebrow mb-2 flex items-center gap-1.5">
                <Layers size={12} /> Capas
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {(Object.keys(LAYER_LABEL) as (keyof MapLayers)[]).map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 text-xs text-muted hover:text-ink">
                    <input type="checkbox" checked={layers[k]} onChange={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} className="accent-[var(--accent)]" />
                    {LAYER_LABEL[k]}
                  </label>
                ))}
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted hover:text-ink">
                  <input type="checkbox" checked={showContext} onChange={() => setShowContext((v) => !v)} className="accent-[var(--accent)]" />
                  Resto atenuado
                </label>
              </div>
            </div>
            <MapLegend />
            <p className="text-[11px] text-faint">Haz clic en un ejemplar o en una zona para ver aquí su detalle.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

/** Busca un ejemplar por código, nombre, especie o equipo y lo ubica en el mapa. */
function PenguinSearch({ penguins, teamName, onPick }: { penguins: Penguin[]; teamName: (id: string) => string; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const results = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    return penguins
      .filter((p) => norm(`${p.id} ${p.name ?? ""} ${SPECIES_BY_ID[p.speciesId].nameEs} ${teamName(p.id)}`).includes(t))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, penguins]);

  const pick = (p: Penguin) => {
    onPick(p.id);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="relative mt-3">
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHi(0);
        }}
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
        placeholder="Buscar pingüino (código, nombre, especie…)"
        aria-label="Buscar pingüino"
        className="h-9 w-full rounded-xl border border-line-strong bg-panel-solid pl-8 pr-3 text-xs text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      {open && q.trim() && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line-strong bg-panel-solid p-1 shadow-[0_4px_14px_rgba(11,36,64,0.10)]">
          {results.length === 0 && <li className="px-3 py-2.5 text-xs text-muted">Ningún pingüino coincide.</li>}
          {results.map((p, i) => (
            <li key={p.id}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(p)}
                className={cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left", i === hi && "bg-ink/[0.05]")}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SPECIES_BY_ID[p.speciesId].color }} />
                <span className="w-[72px] shrink-0 font-mono text-xs">{p.id}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{p.name ?? SPECIES_BY_ID[p.speciesId].nameEs.replace("Pingüino ", "")}</span>
                <span className="shrink-0 text-[11px] text-faint">{teamName(p.id)}</span>
              </button>
            </li>
          ))}
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
      className={cx(
        "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition",
        on ? "border-accent/60 bg-accent/10" : "border-line bg-ink/[0.05] hover:border-line-strong",
      )}
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

function MapLegend() {
  return (
    <div>
      <p className="eyebrow mb-2">Leyenda</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-muted">
        <LegendItem icon={<circle cx="7" cy="7" r="5" fill="#9fb4c7" stroke="#03101c" />}>En tierra</LegendItem>
        <LegendItem icon={<><circle cx="7" cy="7" r="6.3" fill="none" stroke="#4fb3ff" /><circle cx="7" cy="7" r="4" fill="#9fb4c7" /></>}>En agua (precisión de zona)</LegendItem>
        <LegendItem icon={<><circle cx="7" cy="7" r="5" fill="#9fb4c7" /><circle cx="7" cy="7" r="1.8" fill="#03101c" /></>}>Sin movimiento registrado</LegendItem>
        <LegendItem icon={<><path d="M1 7 H13" stroke="#0b6f68" strokeWidth="3" strokeLinecap="round" /><circle cx="12" cy="7" r="2.2" fill="#2b7fd0" stroke="#fff" /></>}>Recorrido (últimas 6 h)</LegendItem>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-faint">
        Color del marcador = especie. Las líneas del recorrido solo unen lecturas consecutivas. Al reproducir, el desplazamiento entre dos
        lecturas es una animación visual.
      </p>
    </div>
  );
}

function LegendItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5")}>
      <svg width="14" height="14" viewBox="0 0 14 14">
        {icon}
      </svg>
      {children}
    </span>
  );
}
