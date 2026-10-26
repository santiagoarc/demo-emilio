"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowRightLeft, ArrowUpRight, Bird, CalendarDays, Clock, Droplets, Route, ShieldQuestion, Users } from "lucide-react";
import { HABITAT, PENGUIN_ZONES, ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES } from "@/domain/species";
import { computeActivity, perPenguinPerDay, sumBreakdowns, type Breakdown } from "@/logic/metrics";
import { firstIndexAtOrAfter } from "@/logic/status";
import { DAY, HOUR, fmtDate, fmtDateTime, fmtHours, fmtTime, fmtWeekday, startOfDay } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { PageHeader } from "@/components/shell/AppShell";
import { GlobalFilters } from "@/components/filters/GlobalFilters";
import { Card, EmptyState, Select } from "@/components/ui/primitives";
import { Heatmap, Legend, LineChart, Matrix, SERIES, SplitBar, StackedColumns } from "@/components/charts/Charts";

const ZONE_COLOR: Record<string, string> = {
  "main-pool": "#3b9fe8",
  "deep-dive": "#1f6fb8",
  "wading-shore": "#6cc6ff",
  "snow-beach": "#e8f2f8",
  "ice-ridge": "#b8cfe0",
  "nesting-rocks": "#8aa0b6",
  "pebble-beach": "#a7b6c4",
  "observation-ledge": "#c9d6e2",
  "feeding-north": "#2fd8c8",
  "feeding-south": "#22a99c",
  "care-bay": "#a78bfa",
  "vet-holding": "#7c5cd6",
};

export function AnalyticsView() {
  const { dataset, visible, range, filters, teamOf } = useDemo();
  const ids = useMemo(() => visible.map((p) => p.id), [visible]);
  const zoneSet = useMemo(() => new Set(filters.zones), [filters.zones]);
  const agg = useMemo(() => computeActivity(dataset, ids, range.from, range.to, zoneSet), [dataset, ids, range, zoneSet]);
  const t = agg.totals;
  const n = ids.length;
  const coverage = t.expected ? (t.water + t.land) / t.expected : 0;
  const multiDay = range.to - range.from > 1.5 * DAY;

  const heat = useMemo(() => {
    const days: number[] = [];
    for (let d = startOfDay(range.from); d < range.to; d += DAY) days.push(d);
    const water = days.map(() => new Array(24).fill(0));
    const total = days.map(() => new Array(24).fill(0));
    for (const id of ids) {
      const list = dataset.readings.get(id) ?? [];
      for (let i = firstIndexAtOrAfter(list, range.from); i < list.length && list[i].timestamp < range.to; i++) {
        const r = list[i];
        if (zoneSet.size && !zoneSet.has(r.zoneId)) continue;
        const di = Math.floor((startOfDay(r.timestamp) - days[0]) / DAY);
        const h = new Date(r.timestamp).getHours();
        if (di < 0 || di >= days.length) continue;
        total[di][h]++;
        if (r.medium === "water") water[di][h]++;
      }
    }
    return { days, water, total };
  }, [dataset, ids, range, zoneSet]);

  const groupRows = (groups: { key: string; label: string; color: string; ids: string[] }[]) =>
    groups.map((g) => {
      const b = sumBreakdowns(g.ids.map((id) => agg.perPenguin.get(id)).filter((x): x is Breakdown => !!x));
      return {
        ...g,
        water: perPenguinPerDay(b.water, g.ids.length, range.from, range.to),
        land: perPenguinPerDay(b.land, g.ids.length, range.from, range.to),
        gap: perPenguinPerDay(b.noFix + b.noComm, g.ids.length, range.from, range.to),
      };
    });
  const bySpecies = groupRows(SPECIES.map((s) => ({ key: s.id, label: s.nameEs, color: s.color, ids: visible.filter((p) => p.speciesId === s.id).map((p) => p.id) }))).filter((g) => g.ids.length);
  const byTeam = groupRows(dataset.teams.map((tm) => ({ key: tm.id, label: tm.name, color: tm.color, ids: visible.filter((p) => teamOf(p.id) === tm.id).map((p) => p.id) }))).filter((g) => g.ids.length);

  const zonesInMatrix = PENGUIN_ZONES.map((z) => z.id);
  const topTransitions = [...agg.transitions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const transitionsTotal = [...agg.transitions.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Análisis"
        title="Activity Analytics"
        subtitle="Todas las gráficas se calculan desde las lecturas simuladas y responden a los filtros. El tiempo sin lectura nunca se reparte entre agua y tierra."
      />
      <div className="space-y-5 px-6 lg:px-8">
        <div className="panel-flat p-4">
          <GlobalFilters showPenguin />
        </div>

        {n === 0 || range.to <= range.from ? (
          <Card>
            <EmptyState icon={Activity} title={n === 0 ? "Ningún ejemplar coincide con los filtros" : "El rango de fechas está vacío"}>
              {n === 0 ? "Ajusta especie, equipo, ejemplar o zona." : "Elige una fecha final posterior a la inicial dentro de la historia disponible."}
            </EmptyState>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              <Kpi label="Ejemplares analizados" value={String(n)} />
              <Kpi label="Horas en agua" value={fmtHours(t.water)} color={SERIES.water} sub={`${fmtHours(perPenguinPerDay(t.water, n, range.from, range.to))} por ejemplar/día`} />
              <Kpi label="Horas en tierra" value={fmtHours(t.land)} color={SERIES.land} sub={`${fmtHours(perPenguinPerDay(t.land, n, range.from, range.to))} por ejemplar/día`} />
              <Kpi label="Sin movimiento registrado" value={fmtHours(t.stationary)} color={SERIES.stationary} sub="lecturas repetidas en tierra" />
              <Kpi label="Cobertura de lecturas" value={zoneSet.size ? "—" : `${Math.round(coverage * 100)}%`} sub={zoneSet.size ? "no aplica con filtro de zona" : "tiempo con lectura / esperado"} />
              <Kpi label="Cambios de zona" value={String(transitionsTotal)} sub="entre lecturas consecutivas" />
            </div>

            <div className="grid gap-5 xl:grid-cols-12">
              <Card className="xl:col-span-8" title="Tiempo en agua frente a tiempo en tierra" subtitle={`${range.label} · horas-ejemplar por ${multiDay ? "día" : "hora"}`} icon={Droplets}
                action={<Legend items={[{ color: SERIES.water, label: "Agua" }, { color: SERIES.land, label: "Tierra" }, { color: SERIES.noFix, label: "Sin posición" }, { color: SERIES.noComm, label: "Sin comunicación" }]} />}>
                <StackedColumns
                  height={210}
                  labelEvery={multiDay ? 1 : 3}
                  format={fmtHours}
                  series={[
                    { key: "water", color: SERIES.water, label: "Agua" },
                    { key: "land", color: SERIES.land, label: "Tierra" },
                    { key: "noFix", color: SERIES.noFix, label: "Sin posición" },
                    { key: "noComm", color: SERIES.noComm, label: "Sin comunicación" },
                  ]}
                  data={
                    multiDay
                      ? agg.daily.map((d) => ({ label: fmtDate(d.day), tooltip: fmtWeekday(d.day), values: { water: d.water, land: d.land, noFix: d.noFix, noComm: d.noComm } }))
                      : hourlyInRange(dataset, ids, range.from, range.to, zoneSet)
                  }
                />
              </Card>
              <Card className="xl:col-span-4" title="Lo que significa cada hueco" icon={ShieldQuestion}>
                <ul className="space-y-4 text-xs">
                  <Explain color={SERIES.noFix} title="Ausencia de datos de posición" value={fmtHours(t.noFix)}>
                    El dispositivo seguía comunicando pero no entregó posición (p. ej. cobertura acústica bajo el agua). No se sabe dónde estaba.
                  </Explain>
                  <Explain color={SERIES.stationary} title="Sin movimiento registrado" value={fmtHours(t.stationary)}>
                    Hay lecturas, y repiten la misma posición. Describe las lecturas, no afirma que el ejemplar estuviera inmóvil entre ellas.
                  </Explain>
                  <Explain color={SERIES.noComm} title="Posible problema de conectividad" value={fmtHours(t.noComm)}>
                    El dispositivo dejó de comunicar. Se conserva la última ubicación conocida y se genera una alerta operativa.
                  </Explain>
                </ul>
                {zoneSet.size > 0 && <p className="mt-4 text-[11px] text-faint">Con filtro de zona los huecos no se pueden atribuir a una zona y no se muestran.</p>}
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-12">
              <Card className="xl:col-span-5" title="Actividad por hora del día" subtitle="Suma del periodo por franja horaria" icon={Clock}>
                <StackedColumns
                  height={190}
                  labelEvery={3}
                  format={fmtHours}
                  series={[
                    { key: "water", color: SERIES.water, label: "Agua" },
                    { key: "land", color: SERIES.land, label: "Tierra" },
                    { key: "gap", color: SERIES.noFix, label: "Sin lectura" },
                  ]}
                  data={agg.hourly.map((h, i) => ({ label: `${String(i).padStart(2, "0")}h`, tooltip: `${String(i).padStart(2, "0")}:00 – ${String(i).padStart(2, "0")}:59`, values: { water: h.water, land: h.land, gap: h.noFix + h.noComm } }))}
                />
              </Card>
              <Card className="xl:col-span-7" title="Proporción en agua por día y hora" subtitle="Celdas rayadas: sin lecturas en esa franja" icon={CalendarDays}>
                <Heatmap
                  rows={heat.days.map((_, i) => i)}
                  cols={Array.from({ length: 24 }, (_, i) => i)}
                  value={(r, c) => (heat.total[r][c] ? heat.water[r][c] / heat.total[r][c] : null)}
                  color="79,179,255"
                  format={(v) => `${Math.round(v * 100)}% en agua`}
                  rowLabel={(r) => fmtWeekday(heat.days[r])}
                  colLabel={(c) => `${c}h`}
                />
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-12">
              <Card className="xl:col-span-8" title="Movimientos entre zonas" subtitle="Cambios entre lecturas consecutivas sin hueco. Un hueco no cuenta como movimiento observado." icon={ArrowRightLeft}>
                {transitionsTotal === 0 ? (
                  <EmptyState icon={ArrowRightLeft} title="Sin cambios de zona observados en el periodo" />
                ) : (
                  <Matrix
                    rows={zonesInMatrix}
                    cols={zonesInMatrix}
                    value={(r, c) => agg.transitions.get(`${r}>${c}`) ?? 0}
                    rowLabel={(k) => ZONE_BY_ID[k].name}
                    colLabel={(k) => ZONE_BY_ID[k].name}
                  />
                )}
              </Card>
              <Card className="xl:col-span-4" title="Recorridos más frecuentes" icon={Route}>
                <ul className="space-y-3">
                  {topTransitions.map(([k, v]) => {
                    const [a, b] = k.split(">");
                    return (
                      <li key={k}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="truncate">
                            {ZONE_BY_ID[a].name} <span className="text-faint">→</span> {ZONE_BY_ID[b].name}
                          </span>
                          <span className="num font-semibold">{v}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${(v / topTransitions[0][1]) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                  {topTransitions.length === 0 && <li className="text-xs text-muted">Sin datos.</li>}
                </ul>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card title="Comparación por especie" subtitle="Promedio por ejemplar y día" icon={Bird} action={<CompareLegend />}>
                <CompareRows rows={bySpecies} />
              </Card>
              <Card title="Comparación por equipo" subtitle="Promedio por ejemplar y día" icon={Users} action={<CompareLegend />}>
                <CompareRows rows={byTeam} />
              </Card>
            </div>

            <Card title="Evolución de la actividad por día" subtitle="Promedio por ejemplar · horas por día" icon={Activity}
              action={<Legend items={[{ color: SERIES.water, label: "Agua" }, { color: SERIES.land, label: "Tierra" }, { color: SERIES.noFix, label: "Sin lectura", dashed: true }]} />}>
              {agg.daily.length < 2 ? (
                <p className="py-8 text-center text-xs text-muted">Elige un periodo de varios días para ver la evolución.</p>
              ) : (
                <LineChart
                  height={220}
                  format={(v) => `${v.toFixed(1)}h`}
                  series={[
                    { key: "water", color: SERIES.water, label: "Agua", area: true },
                    { key: "land", color: SERIES.land, label: "Tierra", area: true },
                    { key: "gap", color: SERIES.noFix, label: "Sin lectura", dashed: true },
                  ]}
                  data={agg.daily.map((d) => {
                    const span = Math.max(0, Math.min(d.day + DAY, range.to) - Math.max(d.day, range.from)) / DAY;
                    const per = (v: number) => (n && span > 0.04 ? v / n / HOUR / span : null);
                    return { label: fmtWeekday(d.day), values: { water: per(d.water), land: per(d.land), gap: per(d.noFix + d.noComm) } };
                  })}
                />
              )}
            </Card>

            <PenguinTimeline />
          </>
        )}
      </div>
    </div>
  );
}

function hourlyInRange(dataset: ReturnType<typeof useDemo>["dataset"], ids: string[], from: number, to: number, zones: Set<string>) {
  const out: { label: string; tooltip: string; values: Record<string, number> }[] = [];
  for (let h = startOfDay(from) + Math.floor((from - startOfDay(from)) / HOUR) * HOUR; h < to; h += HOUR) {
    const a = computeActivity(dataset, ids, h, h + HOUR, zones).totals;
    out.push({ label: fmtTime(h).slice(0, 2) + "h", tooltip: fmtDateTime(h, dataset.now), values: { water: a.water, land: a.land, noFix: a.noFix, noComm: a.noComm } });
  }
  return out;
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="panel p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {color && <span className="h-2 w-2 rounded-sm" style={{ background: color }} />}
        {label}
      </p>
      <p className="num mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-faint">{sub}</p>}
    </div>
  );
}

function Explain({ color, title, value, children }: { color: string; title: string; value: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
      <div>
        <p className="flex items-baseline justify-between gap-2 font-medium text-ink">
          {title} <span className="num text-sm">{value}</span>
        </p>
        <p className="mt-0.5 leading-snug text-muted">{children}</p>
      </div>
    </li>
  );
}

function CompareLegend() {
  return <Legend items={[{ color: SERIES.water, label: "Agua" }, { color: SERIES.land, label: "Tierra" }, { color: "rgba(245,184,75,0.6)", label: "Sin lectura" }]} />;
}

function CompareRows({ rows }: { rows: { key: string; label: string; color: string; ids: string[]; water: number; land: number; gap: number }[] }) {
  if (!rows.length) return <p className="text-xs text-muted">Sin datos.</p>;
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
              {r.label} <span className="text-faint">· {r.ids.length}</span>
            </span>
            <span className="num text-muted">
              <b className="text-ink">{fmtHours(r.water)}</b> agua · <b className="text-ink">{fmtHours(r.land)}</b> tierra
            </span>
          </div>
          <SplitBar
            parts={[
              { value: r.water, color: SERIES.water, label: "Agua" },
              { value: r.land, color: SERIES.land, label: "Tierra" },
              { value: r.gap, color: "rgba(245,184,75,0.6)", label: "Sin lectura" },
            ]}
          />
        </li>
      ))}
    </ul>
  );
}

/** Historial de localización de un ejemplar: banda de zonas en el tiempo. */
function PenguinTimeline() {
  const { dataset, visible, filters, range, now } = useDemo();
  const [local, setLocal] = useState<string>("");
  const id = filters.penguinId ?? (local || visible[0]?.id);
  const recs = (dataset.activity.get(id) ?? []).filter((r) => r.end > range.from && r.start < range.to);
  const gaps = (dataset.gaps.get(id) ?? []).filter((g) => g.end > range.from && g.start < range.to);
  const span = range.to - range.from;
  const pct = (t: number) => ((Math.min(Math.max(t, range.from), range.to) - range.from) / span) * 100;
  const zonesUsed = [...new Set(recs.map((r) => r.zoneId))];
  const ticks: number[] = [];
  const step = span > 3 * DAY ? DAY : span > DAY ? 6 * HOUR : 3 * HOUR;
  for (let t = Math.ceil(range.from / step) * step; t < range.to; t += step) ticks.push(t);

  return (
    <Card
      title="Historial de localización de un ejemplar"
      subtitle="Cada tramo es una secuencia de lecturas en la misma zona. Los huecos se marcan con su causa."
      icon={Route}
      action={
        <div className="flex items-center gap-2">
          {filters.penguinId ? (
            <span className="text-xs text-muted">Ejemplar del filtro</span>
          ) : (
            <Select value={id ?? ""} onChange={(e) => setLocal(e.target.value)} className="h-8 text-xs" aria-label="Ejemplar">
              {visible.map((p) => (
                <option key={p.id} value={p.id}>{p.id}</option>
              ))}
            </Select>
          )}
          {id && (
            <Link href={`/penguins/${id}`} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
              Ficha <ArrowUpRight size={12} />
            </Link>
          )}
        </div>
      }
    >
      {!id ? (
        <p className="text-xs text-muted">Sin ejemplares.</p>
      ) : (
        <>
          <div className="relative h-12 overflow-hidden rounded-xl border border-line bg-ink/[0.05]">
            {recs.map((r) => (
              <div
                key={r.start}
                title={`${ZONE_BY_ID[r.zoneId].name} · ${fmtDateTime(r.start, now)} – ${fmtTime(r.end)}${r.stationary && r.readings > 1 ? " · sin movimiento registrado" : ""}`}
                className="absolute inset-y-1.5 rounded-[3px]"
                style={{ left: `${pct(r.start)}%`, width: `max(2px, ${pct(r.end) - pct(r.start)}%)`, background: ZONE_COLOR[r.zoneId] ?? "#888" }}
              />
            ))}
            {gaps.map((g) => (
              <div
                key={`g${g.start}`}
                title={`${g.kind === "no_comm" ? "Sin comunicación" : "Sin posición"} · ${fmtDateTime(g.start, now)} – ${fmtTime(g.end)}`}
                className="absolute inset-y-0"
                style={{
                  left: `${pct(g.start)}%`,
                  width: `max(2px, ${pct(g.end) - pct(g.start)}%)`,
                  background: `repeating-linear-gradient(45deg, ${g.kind === "no_comm" ? "rgba(255,107,107,0.55)" : "rgba(245,184,75,0.55)"} 0 3px, transparent 3px 6px)`,
                }}
              />
            ))}
          </div>
          <div className="relative mt-1 h-4 text-[10px] text-faint">
            {ticks.map((t) => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pct(t)}%` }}>
                {step >= DAY ? fmtDate(t) : fmtTime(t)}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
            {zonesUsed.map((z) => (
              <span key={z} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: ZONE_COLOR[z] }} />
                {ZONE_BY_ID[z].name}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm" style={{ background: "repeating-linear-gradient(45deg, rgba(245,184,75,0.8) 0 2px, transparent 2px 4px)" }} />
              Sin posición
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm" style={{ background: "repeating-linear-gradient(45deg, rgba(255,107,107,0.8) 0 2px, transparent 2px 4px)" }} />
              Sin comunicación
            </span>
          </div>
          {recs.length === 0 && gaps.length === 0 && <p className="mt-3 text-xs text-muted">Sin datos para este ejemplar en el periodo (puede ser anterior a su alta).</p>}
          <p className="mt-2 text-[11px] text-faint">Plano: {HABITAT.name}.</p>
        </>
      )}
    </Card>
  );
}
