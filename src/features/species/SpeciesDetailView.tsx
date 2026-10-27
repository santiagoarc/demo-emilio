"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  MapPinned,
  Mountain,
  Search,
  SearchX,
  Users,
  Waves,
  X,
} from "lucide-react";
import { ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES_BY_ID } from "@/domain/species";
import type { SpeciesId } from "@/domain/types";
import { computeActivity, perPenguinPerDay, type Breakdown } from "@/logic/metrics";
import { STATUS_LABEL, type LiveStatus, type Snapshot } from "@/logic/status";
import { fmtDateTime, fmtHours, fmtTime } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { Card, EmptyState, SimulatedTag, cx } from "@/components/ui/primitives";
import { Donut, SERIES, StackedColumns } from "@/components/charts/Charts";
import { FilterMenu } from "@/components/filters/FilterMenu";
import { PeriodPicker } from "@/components/filters/PeriodPicker";
import { PenguinIllustration } from "@/components/penguin/PenguinIllustration";
import { StatusPill, STATUS_COLOR } from "@/components/penguin/StatusPill";
import { SpeciesPenguinPanel } from "./SpeciesPenguinPanel";

type SortKey = "id" | "name" | "last" | "water" | "land";
type ActivityFilter = "water" | "land" | "nodata";

const UNASSIGNED = "__none";
const NO_ZONE = "__none";

export function SpeciesDetailView() {
  const { id } = useParams<{ id: string }>();
  const sp = SPECIES_BY_ID[id as SpeciesId];
  if (!sp) {
    return (
      <div className="p-8">
        <Card>
          <EmptyState icon={SearchX} title={`No existe la especie "${id}"`} action={<Link href="/species" className="text-sm text-accent hover:underline">Volver a Species</Link>} />
        </Card>
      </div>
    );
  }
  return <Detail speciesId={sp.id} />;
}

/** Estado de la tabla en la URL: se conserva al abrir una ficha y volver. */
function useTableState(speciesId: string) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const storeKey = `penguin-demo/species-table/${speciesId}`;

  // Al volver sin parámetros (p. ej. desde la ficha), recupera la última vista.
  useEffect(() => {
    if (params.toString()) return;
    try {
      const saved = sessionStorage.getItem(storeKey);
      if (saved) router.replace(`${pathname}?${saved}`, { scroll: false });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = (k: string) => (params.get(k) ? params.get(k)!.split(",") : []);
  const state = {
    q: params.get("q") ?? "",
    teams: list("team"),
    zones: list("zone"),
    status: list("st") as LiveStatus[],
    activity: list("act") as ActivityFilter[],
    sort: (params.get("sort") as SortKey) || "id",
    dir: (params.get("dir") === "desc" ? "desc" : "asc") as "asc" | "desc",
    sel: params.get("sel"),
  };

  const set = (patch: Partial<Record<"q" | "team" | "zone" | "st" | "act" | "sort" | "dir" | "sel", string | string[] | number | null>>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      const s = Array.isArray(v) ? v.join(",") : v == null ? "" : String(v);
      if (s) next.set(k, s);
      else next.delete(k);
    }
    const qs = next.toString();
    try {
      sessionStorage.setItem(storeKey, qs);
    } catch {}
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return { ...state, set };
}

function Detail({ speciesId }: { speciesId: SpeciesId }) {
  const { dataset, snapshots, teamOf, range, now } = useDemo();
  const sp = SPECIES_BY_ID[speciesId];
  const t = useTableState(speciesId);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState(t.q);
  const clearAll = () => {
    setQ("");
    t.set({ q: null, team: null, zone: null, st: null, act: null });
  };

  const all = useMemo(() => dataset.penguins.filter((p) => p.speciesId === speciesId), [dataset, speciesId]);
  const allIds = useMemo(() => all.map((p) => p.id), [all]);
  const agg = useMemo(() => computeActivity(dataset, allIds, range.from, range.to), [dataset, allIds, range]);

  const teamKey = (pid: string) => {
    const tid = teamOf(pid);
    return dataset.teams.some((x) => x.id === tid) ? tid : UNASSIGNED;
  };

  type Row = { id: string; name?: string; snap: Snapshot; b?: Breakdown; team: string; zone: string };
  const rowsAll: Row[] = useMemo(
    () =>
      all.map((p) => {
        const snap = snapshots.get(p.id)!;
        return { id: p.id, name: p.name, snap, b: agg.perPenguin.get(p.id), team: teamKey(p.id), zone: snap.reading?.zoneId ?? NO_ZONE };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, snapshots, agg, teamOf],
  );

  const filtered = useMemo(() => {
    const q = t.q.trim().toLowerCase();
    const rows = rowsAll.filter((r) => {
      const p = dataset.penguins.find((x) => x.id === r.id)!;
      if (q && ![r.id, r.name ?? "", p.deviceId].some((v) => v.toLowerCase().includes(q))) return false;
      if (t.teams.length && !t.teams.includes(r.team)) return false;
      if (t.zones.length && !t.zones.includes(r.zone)) return false;
      if (t.status.length && !t.status.includes(r.snap.status)) return false;
      if (t.activity.length) {
        const kind: ActivityFilter = !r.b || r.b.readings === 0 ? "nodata" : r.b.water >= r.b.land ? "water" : "land";
        if (!t.activity.includes(kind)) return false;
      }
      return true;
    });
    const val = (r: Row): number | string => {
      switch (t.sort) {
        case "name":
          return r.name ?? "￿";
        case "last":
          return r.snap.reading?.timestamp ?? 0;
        case "water":
          return r.b?.water ?? -1;
        case "land":
          return r.b?.land ?? -1;
        default:
          return r.id;
      }
    };
    const sign = t.dir === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === "string" ? x.localeCompare(y as string) : x - (y as number);
      return c * sign || a.id.localeCompare(b.id);
    });
    return rows;
  }, [rowsAll, t.q, t.teams, t.zones, t.status, t.activity, t.sort, t.dir, dataset]);

  const filteredIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const isFiltered = filtered.length !== rowsAll.length;
  const panelAgg = useMemo(() => computeActivity(dataset, filteredIds, range.from, range.to), [dataset, filteredIds, range]);
  const span = range.to - range.from;
  const prevFrom = range.from - span;
  const prevAgg = useMemo(
    () => (prevFrom >= dataset.windowStart ? computeActivity(dataset, filteredIds, prevFrom, range.from) : null),
    [dataset, filteredIds, prevFrom, range.from],
  );

  // --- Indicadores (sobre los ejemplares filtrados) ---
  const inWater = filtered.filter((r) => r.snap.status === "water").length;
  const onLand = filtered.filter((r) => r.snap.status === "land" || r.snap.status === "resting").length;
  const teamsInUse = new Set(filtered.map((r) => r.team).filter((x) => x !== UNASSIGNED)).size;

  // --- Zonas y equipos (sobre toda la especie; sirven de filtro) ---
  const zoneRows = useMemo(() => {
    const m = new Map<string, { n: number; last: number }>();
    for (const r of rowsAll) {
      const e = m.get(r.zone) ?? { n: 0, last: 0 };
      e.n++;
      e.last = Math.max(e.last, r.snap.reading?.timestamp ?? 0);
      m.set(r.zone, e);
    }
    return [...m.entries()].sort((a, b) => (a[0] === NO_ZONE ? 1 : b[0] === NO_ZONE ? -1 : b[1].n - a[1].n));
  }, [rowsAll]);

  const teamRows = useMemo(() => {
    const m = new Map<string, { n: number }>();
    for (const r of rowsAll) {
      const e = m.get(r.team) ?? { n: 0 };
      e.n++;
      m.set(r.team, e);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [rowsAll]);

  const maxH = Math.max(1, ...filtered.map((r) => Math.max(r.b?.water ?? 0, r.b?.land ?? 0)));

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const sortBy = (k: SortKey) => t.set({ sort: k, dir: t.sort === k && t.dir === "asc" ? "desc" : "asc" });
  const hasFilters = !!(t.q || t.teams.length || t.zones.length || t.status.length || t.activity.length);
  const teamName = (k: string) => (k === UNASSIGNED ? "Sin asignar" : dataset.teams.find((x) => x.id === k)?.name ?? k);
  const teamColor = (k: string) => dataset.teams.find((x) => x.id === k)?.color ?? "#56718a";

  const exportCsv = () => {
    const rows = checked.size ? filtered.filter((r) => checked.has(r.id)) : filtered;
    const head = ["Código", "Nombre", "Especie", "Estado", "Zona", "Equipo", "Agua (h)", "Tierra (h)", "Última lectura"];
    const lines = rows.map((r) => [
      r.id,
      r.name ?? "",
      sp.nameEs,
      STATUS_LABEL[r.snap.status],
      r.zone === NO_ZONE ? "" : ZONE_BY_ID[r.zone].name,
      teamName(r.team),
      r.b?.readings ? (r.b.water / 3_600_000).toFixed(1) : "",
      r.b?.readings ? (r.b.land / 3_600_000).toFixed(1) : "",
      r.snap.reading ? new Date(r.snap.reading.timestamp).toISOString() : "",
    ]);
    const csv = [head, ...lines].map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ejemplares-${sp.code}-simulado.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tot = panelAgg.totals;
  const perDay = (v: number, agg = panelAgg) => perPenguinPerDay(v, agg.penguinCount, agg.from, agg.to);
  const avg = { water: perDay(tot.water), land: perDay(tot.land) };
  const avgTotal = avg.water + avg.land;
  const prev = prevAgg && {
    water: perDay(prevAgg.totals.water, prevAgg),
    land: perDay(prevAgg.totals.land, prevAgg),
  };

  return (
    <div className="pb-10">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-4 px-6 pb-4 pt-6 lg:px-8">
        <Link
          href="/species"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 pl-2.5 pr-4 text-sm font-medium text-ink transition hover:border-accent hover:bg-accent/20"
        >
          <ChevronLeft size={18} className="text-accent" />
          Todas las especies
        </Link>
        <span className="hidden h-10 w-px bg-line sm:block" />
        <PenguinIllustration speciesId={speciesId} size={60} />
        <div className="min-w-0 flex-1">
          <nav className="flex items-center gap-1 text-xs text-muted">
            <Link href="/species" className="hover:text-ink">Species</Link>
            <ChevronRight size={12} className="text-faint" />
            <span className="text-ink">{sp.nameEs}</span>
          </nav>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{sp.nameEs}</h1>
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: sp.color }} />
              {sp.nameEn} · <i>{sp.scientific}</i>
            </span>
            <SimulatedTag />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/map?species=${speciesId}`}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-line-strong px-3.5 text-sm font-medium text-ink transition hover:border-accent/50"
          >
            <MapPinned size={15} /> Ver en el mapa
          </Link>
          <PeriodPicker />
        </div>
      </div>

      <div className="space-y-5 px-6 lg:px-8">
        {/* Indicadores */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={<PenguinIllustration speciesId={speciesId} size={38} framed={false} />} value={filtered.length} label="Ejemplares registrados" note={isFiltered ? `de ${rowsAll.length} · filtrados` : undefined} />
          <KpiCard icon={<Waves size={22} />} color="#5cb8ff" value={inWater} label="En agua ahora" side={filtered.length ? `${Math.round((inWater / filtered.length) * 100)}%` : "—"} />
          <KpiCard icon={<Mountain size={22} />} color="#9fb4c7" value={onLand} label="En tierra ahora" side={filtered.length ? `${Math.round((onLand / filtered.length) * 100)}%` : "—"} />
          <KpiCard icon={<Users size={22} />} color="#a78bfa" value={teamsInUse} label="Equipos responsables" />
        </div>

        {/* Paneles */}
        <div className="grid gap-5 xl:grid-cols-12">
          <Card
            className="xl:col-span-7"
            title="Actividad de la especie"
            subtitle={`Promedio por ejemplar por día · ${range.label.toLowerCase()}${isFiltered ? " · ejemplares filtrados" : ""}`}
          >
            {panelAgg.penguinCount === 0 ? (
              <p className="py-6 text-center text-xs text-muted">Sin datos con los filtros actuales.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-5">
                  <Donut
                    size={124}
                    thickness={14}
                    parts={[
                      { value: avg.water, color: SERIES.water, label: "Agua" },
                      { value: avg.land, color: SERIES.land, label: "Tierra" },
                    ]}
                    center={
                      <div>
                        <p className="num text-lg font-semibold leading-none">{fmtHours(avgTotal)}</p>
                        <p className="text-[10px] text-faint">por día</p>
                      </div>
                    }
                  />
                  <div className="min-w-[180px] flex-1 space-y-2 text-sm">
                    {(
                      [
                        ["Agua", avg.water, SERIES.water, prev?.water],
                        ["Tierra", avg.land, SERIES.land, prev?.land],
                      ] as const
                    ).map(([label, v, color, pv]) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                        <span className="flex-1 text-muted">{label}</span>
                        <span className="num font-semibold">{fmtHours(v)}</span>
                        <span className="num w-10 text-right text-xs text-faint">{avgTotal ? `${Math.round((v / avgTotal) * 100)}%` : "—"}</span>
                        <span className="num w-16 text-right text-[11px] text-faint" title="Contra el periodo anterior de la misma duración">
                          {pv === undefined ? "" : `${v - pv >= 0 ? "+" : "−"}${fmtHours(Math.abs(v - pv))}`}
                        </span>
                      </div>
                    ))}
                    <p className="text-[10px] text-faint">{prev ? "Última columna: diferencia contra el periodo anterior de igual duración." : "Sin periodo anterior completo para comparar."}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-[11px] text-muted">Distribución por hora del día (horas registradas, suma de ejemplares)</p>
                  <StackedColumns
                    height={78}
                    labelEvery={6}
                    format={fmtHours}
                    series={[
                      { key: "water", color: SERIES.water, label: "Agua" },
                      { key: "land", color: SERIES.land, label: "Tierra" },
                    ]}
                    data={panelAgg.hourly.map((h, i) => ({ label: `${i}h`, tooltip: `${String(i).padStart(2, "0")}:00`, values: { water: h.water, land: h.land } }))}
                  />
                </div>
                <p className="mt-3 text-[10px] text-faint">Promedios calculados desde lecturas simuladas.</p>
              </>
            )}
          </Card>

          <div className="flex flex-col gap-5 xl:col-span-5">
          <Card className="flex-1" title="Distribución por zona" subtitle="Última ubicación válida de cada ejemplar · clic para filtrar la tabla">
            <ul className="space-y-1">
              {zoneRows.map(([z, e]) => {
                const on = t.zones.includes(z);
                const pctv = Math.round((e.n / rowsAll.length) * 100);
                return (
                  <li key={z} className={cx("group flex items-center gap-2 rounded-lg px-2 py-1.5", on ? "bg-accent/10" : "hover:bg-ink/[0.03]")}>
                    <button onClick={() => t.set({ zone: toggle(t.zones, z) })} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className="w-[108px] shrink-0 truncate text-[13px]">{z === NO_ZONE ? "Sin ubicación" : ZONE_BY_ID[z].name}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.05]">
                        <span className="block h-full rounded-full bg-accent-2" style={{ width: `${pctv}%`, opacity: t.zones.length && !on ? 0.35 : 1 }} />
                      </span>
                      <span className="num w-6 text-right text-[13px] font-semibold">{e.n}</span>
                      <span className="num w-9 text-right text-[11px] text-faint">{pctv}%</span>
                    </button>
                    <span className="w-[68px] shrink-0 text-right text-[10px] leading-tight text-faint" title="Lectura más reciente de los ejemplares en esta zona">
                      {e.last ? fmtTime(e.last) : "Sin datos"}
                    </span>
                    {z !== NO_ZONE ? (
                      <Link href={`/map?zone=${z}&species=${speciesId}`} title="Abrir zona en Habitat Map" className="rounded-md p-1 text-faint hover:bg-ink/5 hover:text-accent">
                        <MapPinned size={13} />
                      </Link>
                    ) : (
                      <span className="w-[21px]" />
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="flex-1" title="Equipos responsables" subtitle="Asignación actual · clic para filtrar">
            <ul className="space-y-1.5">
              {teamRows.map(([k, e]) => {
                const on = t.teams.includes(k);
                const pctv = Math.round((e.n / rowsAll.length) * 100);
                return (
                  <li key={k}>
                    <button
                      onClick={() => t.set({ team: toggle(t.teams, k) })}
                      className={cx("w-full rounded-xl border px-3 py-2 text-left transition", on ? "border-accent/50 bg-accent/10" : "border-line hover:border-line-strong")}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: teamColor(k) }} />
                        <span className="flex-1 truncate text-[13px] font-medium">{teamName(k)}</span>
                        <span className="num text-sm font-semibold">{e.n}</span>
                        <span className="num w-9 text-right text-[11px] text-faint">{pctv}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                        <div className="h-full rounded-full" style={{ width: `${pctv}%`, background: teamColor(k) }} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
          </div>
        </div>

        {/* Tabla + panel lateral */}
        <div className={cx("grid items-start gap-5", t.sel && "xl:grid-cols-[minmax(0,1fr)_340px]")}>
          <section className="panel min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
              <h2 className="text-[17px] font-semibold tracking-tight">
                Ejemplares de {sp.nameEs} <span className="num text-muted">({filtered.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                {checked.size > 0 && (
                  <button onClick={() => setChecked(new Set())} className="text-xs text-muted hover:text-ink">
                    {checked.size} seleccionado{checked.size === 1 ? "" : "s"} · quitar
                  </button>
                )}
                <button
                  onClick={exportCsv}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-xs font-medium text-ink transition hover:border-accent/50"
                >
                  <Download size={14} /> Exportar {checked.size ? "selección" : "CSV"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
              <div className="flex h-10 min-w-[220px] flex-[2] items-center gap-2 rounded-xl border border-line bg-ink/[0.05] px-3">
                <Search size={14} className="text-muted" />
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    t.set({ q: e.target.value });
                  }}
                  placeholder="Buscar por código, nombre o dispositivo…"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
                />
              </div>
              <FilterMenu className="flex-1" label="Equipo" value={t.teams} onChange={(v) => t.set({ team: v })} options={teamRows.map(([k]) => ({ value: k, label: teamName(k), color: teamColor(k) }))} />
              <FilterMenu
                className="flex-1"
                label="Zona"
                allLabel="Todas"
                value={t.zones}
                onChange={(v) => t.set({ zone: v })}
                options={zoneRows.map(([z]) => ({ value: z, label: z === NO_ZONE ? "Sin ubicación" : ZONE_BY_ID[z].name }))}
              />
              <FilterMenu<LiveStatus>
                className="flex-1"
                label="Estado"
                value={t.status}
                onChange={(v) => t.set({ st: v })}
                options={(["water", "land", "resting"] as LiveStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s], color: STATUS_COLOR[s] }))}
              />
              <FilterMenu<ActivityFilter>
                className="flex-1"
                label="Actividad"
                allLabel="Todas"
                value={t.activity}
                onChange={(v) => t.set({ act: v })}
                options={[
                  { value: "water", label: "Más tiempo en agua", color: SERIES.water },
                  { value: "land", label: "Más tiempo en tierra", color: SERIES.land },
                ]}
              />
              {hasFilters && (
                <button onClick={clearAll} className="inline-flex h-10 items-center gap-1 px-2 text-xs text-muted hover:text-ink">
                  <X size={13} /> Limpiar
                </button>
              )}
            </div>

            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] text-muted">
                    <th className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos"
                        className="accent-[var(--accent)]"
                        checked={filtered.length > 0 && filtered.every((r) => checked.has(r.id))}
                        onChange={(e) => {
                          const next = new Set(checked);
                          for (const r of filtered) {
                            if (e.target.checked) next.add(r.id);
                            else next.delete(r.id);
                          }
                          setChecked(next);
                        }}
                      />
                    </th>
                    <th className="px-2 py-2.5 font-medium">Foto</th>
                    <SortTh k="id" t={t} onSort={sortBy}>Código</SortTh>
                    <SortTh k="name" t={t} onSort={sortBy}>Nombre</SortTh>
                    <th className="px-2 py-2.5 font-medium">Estado</th>
                    <th className="px-2 py-2.5 font-medium">Zona actual</th>
                    <th className="px-2 py-2.5 font-medium">Equipo responsable</th>
                    <SortTh k="water" t={t} onSort={sortBy} sub={range.label}>Tiempo en agua</SortTh>
                    <SortTh k="land" t={t} onSort={sortBy} sub={range.label}>Tiempo en tierra</SortTh>
                    <SortTh k="last" t={t} onSort={sortBy}>Última lectura</SortTh>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const sel = t.sel === r.id;
                    const noData = !r.b || r.b.readings === 0;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => t.set({ sel: sel ? null : r.id })}
                        className={cx("cursor-pointer border-b border-line/70 transition last:border-0", sel ? "bg-accent/[0.08]" : "hover:bg-ink/[0.025]")}
                      >
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${r.id}`}
                            className="accent-[var(--accent)]"
                            checked={checked.has(r.id)}
                            onChange={() => {
                              const next = new Set(checked);
                              if (next.has(r.id)) next.delete(r.id);
                              else next.add(r.id);
                              setChecked(next);
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <PenguinIllustration speciesId={speciesId} size={36} />
                        </td>
                        <td className="px-2 py-2 font-mono text-[13px]">{r.id}</td>
                        <td className="px-2 py-2">{r.name ?? <span className="text-faint">Sin nombre</span>}</td>
                        <td className="px-2 py-2">
                          <StatusPill status={r.snap.status} compact />
                        </td>
                        <td className="px-2 py-2">
                          {r.zone === NO_ZONE ? (
                            <span className="text-faint">Sin datos</span>
                          ) : (
                            <span className="inline-flex rounded-md border border-line-strong px-1.5 py-0.5 text-xs text-ink">
                              {ZONE_BY_ID[r.zone].name}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span className="h-2 w-2 rounded-full" style={{ background: teamColor(r.team) }} />
                            {teamName(r.team)}
                          </span>
                        </td>
                        <td className="px-2 py-2">{noData ? <span className="text-xs text-faint">Sin datos</span> : <HBar value={r.b!.water} max={maxH} color={SERIES.water} />}</td>
                        <td className="px-2 py-2">{noData ? <span className="text-xs text-faint">Sin datos</span> : <HBar value={r.b!.land} max={maxH} color="#f5b84b" />}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs text-muted">
                          {r.snap.reading ? fmtDateTime(r.snap.reading.timestamp, now) : "Sin datos"}
                        </td>
                        <td className="pr-3">
                          <Link href={`/penguins/${r.id}`} onClick={(e) => e.stopPropagation()} title="Abrir ficha" className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-ink/5 hover:text-ink">
                            <ChevronRight size={15} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <EmptyState icon={SearchX} title="Ningún ejemplar coincide" action={<button onClick={clearAll} className="text-sm text-accent hover:underline">Limpiar filtros</button>}>
                  Ajusta la búsqueda o los filtros.
                </EmptyState>
              )}
            </div>

            <div className="border-t border-line px-4 py-3 text-xs text-muted">
              {filtered.length} {filtered.length === 1 ? "ejemplar" : "ejemplares"}
            </div>
          </section>

          {t.sel && dataset.penguins.some((p) => p.id === t.sel) && (
            <>
              <div className="fixed inset-0 z-40 bg-black/40 xl:hidden" onClick={() => t.set({ sel: null })} />
              <SpeciesPenguinPanel
                key={t.sel}
                penguinId={t.sel}
                from={range.from}
                to={range.to}
                rangeLabel={range.label}
                onClose={() => t.set({ sel: null })}
                className="fixed inset-y-0 right-0 z-50 w-[min(360px,100vw)] xl:sticky xl:top-4 xl:z-auto xl:w-auto"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, color, value, label, side, sideTone, note }: { icon: ReactNode; color?: string; value: number; label: string; side?: string; sideTone?: "ok"; note?: string }) {
  return (
    <div className="panel flex items-center gap-3 px-4 py-3.5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={color ? { background: `${color}1f`, color } : { background: "rgba(11,36,64,0.04)" }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="num text-2xl font-semibold leading-tight">{value}</p>
        <p className="truncate text-xs text-muted">{label}</p>
        {note && <p className="text-[10px] text-faint">{note}</p>}
      </div>
      {side && <span className={cx("num rounded-md px-1.5 py-0.5 text-xs font-semibold", sideTone === "ok" ? "bg-ok/12 text-ok" : "bg-ink/[0.06] text-muted")}>{side}</span>}
    </div>
  );
}

function SortTh({ k, t, onSort, sub, children }: { k: SortKey; t: { sort: SortKey; dir: "asc" | "desc" }; onSort: (k: SortKey) => void; sub?: string; children: ReactNode }) {
  const on = t.sort === k;
  return (
    <th className="px-2 py-2.5 font-medium">
      <button onClick={() => onSort(k)} className={cx("inline-flex items-start gap-1 text-left hover:text-ink", on && "text-ink")}>
        <span>
          {children}
          {sub && <span className="block text-[10px] font-normal text-faint">{sub}</span>}
        </span>
        {on && (t.dir === "asc" ? <ArrowUp size={11} className="mt-0.5" /> : <ArrowDown size={11} className="mt-0.5" />)}
      </button>
    </th>
  );
}

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-16 overflow-hidden rounded-full bg-ink/[0.05]">
        <span className="block h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
      <span className="num w-12 text-xs">{fmtHours(value)}</span>
    </span>
  );
}

