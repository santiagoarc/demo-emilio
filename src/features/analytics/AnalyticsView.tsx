"use client";

import { useMemo } from "react";
import { Activity, ArrowRightLeft, Bird, CalendarDays, Clock, Droplets, Route, ShieldQuestion, Users } from "lucide-react";
import { PENGUIN_ZONES, ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES } from "@/domain/species";
import { computeActivity, perPenguinPerDay, sumBreakdowns, type Breakdown } from "@/logic/metrics";
import { firstIndexAtOrAfter } from "@/logic/status";
import { DAY, HOUR, fmtDate, fmtDateTime, fmtHours, fmtTime, fmtWeekday, startOfDay } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { PageHeader } from "@/components/shell/AppShell";
import { GlobalFilters } from "@/components/filters/GlobalFilters";
import { Card, EmptyState, cx } from "@/components/ui/primitives";
import { Heatmap, Legend, Matrix, SERIES, SplitBar, StackedColumns, hideTip, showTip } from "@/components/charts/Charts";

export function AnalyticsView() {
  const { dataset, visible, range, filters, teamOf } = useDemo();
  const ids = useMemo(() => visible.map((p) => p.id), [visible]);
  const zoneSet = useMemo(() => new Set(filters.zones), [filters.zones]);
  const agg = useMemo(() => computeActivity(dataset, ids, range.from, range.to, zoneSet), [dataset, ids, range, zoneSet]);
  const t = agg.totals;
  const n = ids.length;
  const multiDay = range.to - range.from > 1.5 * DAY;

  // El mapa de calor muestra siempre la última semana, sin importar el periodo elegido:
  // con "24 h" solo saldrían uno o dos renglones.
  const heat = useMemo(() => {
    const from = Math.max(dataset.windowStart, startOfDay(dataset.now) - 6 * DAY);
    const to = dataset.now + 1;
    const days: number[] = [];
    for (let d = startOfDay(from); d < to; d += DAY) days.push(d);
    const water = days.map(() => new Array(24).fill(0));
    const total = days.map(() => new Array(24).fill(0));
    for (const id of ids) {
      const list = dataset.readings.get(id) ?? [];
      for (let i = firstIndexAtOrAfter(list, from); i < list.length && list[i].timestamp < to; i++) {
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
  }, [dataset, ids, zoneSet]);

  const groupRows = (groups: { key: string; label: string; color: string; ids: string[] }[]) =>
    groups.map((g) => {
      const b = sumBreakdowns(g.ids.map((id) => agg.perPenguin.get(id)).filter((x): x is Breakdown => !!x));
      return {
        ...g,
        water: perPenguinPerDay(b.water, g.ids.length, range.from, range.to),
        land: perPenguinPerDay(b.land, g.ids.length, range.from, range.to),
      };
    });
  const bySpecies = groupRows(SPECIES.map((s) => ({ key: s.id, label: s.nameEs, color: s.color, ids: visible.filter((p) => p.speciesId === s.id).map((p) => p.id) }))).filter((g) => g.ids.length);
  const byTeam = groupRows(dataset.teams.map((tm) => ({ key: tm.id, label: tm.name, color: tm.color, ids: visible.filter((p) => teamOf(p.id) === tm.id).map((p) => p.id) }))).filter((g) => g.ids.length);

  // Solo las zonas con algún movimiento, para que la tabla no lleve renglones vacíos.
  const zonesInMatrix = PENGUIN_ZONES.map((z) => z.id).filter((z) => [...agg.transitions.keys()].some((k) => k.split(">").includes(z)));
  const topTransitions = [...agg.transitions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const transitionsTotal = [...agg.transitions.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Análisis"
        title="Activity Analytics"
        subtitle="Todas las gráficas se calculan desde las lecturas simuladas y responden a los filtros."
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi className="col-span-2 lg:col-span-1" label="Ejemplares analizados" value={String(n)} />
              <Kpi label="Horas en agua" value={fmtHours(t.water)} color={SERIES.water} sub={`${fmtHours(perPenguinPerDay(t.water, n, range.from, range.to))} por ejemplar/día`} />
              <Kpi label="Horas en tierra" value={fmtHours(t.land)} color={SERIES.land} sub={`${fmtHours(perPenguinPerDay(t.land, n, range.from, range.to))} por ejemplar/día`} />
              <Kpi label="Sin movimiento registrado" value={fmtHours(t.stationary)} color={SERIES.stationary} sub="lecturas repetidas en tierra" />
              <Kpi label="Cambios de zona" value={String(transitionsTotal)} sub="entre lecturas consecutivas" />
            </div>

            <div className="grid gap-5 xl:grid-cols-12">
              <Card className="xl:col-span-8" title="Tiempo en agua frente a tiempo en tierra" subtitle={`${range.label} · horas-ejemplar por ${multiDay ? "día" : "hora"}`} icon={Droplets}
                action={<Legend items={[{ color: SERIES.water, label: "Agua" }, { color: SERIES.land, label: "Tierra" }]} />}>
                <StackedColumns
                  height={210}
                  labelEvery={multiDay ? 1 : 3}
                  format={fmtHours}
                  series={[
                    { key: "water", color: SERIES.water, label: "Agua" },
                    { key: "land", color: SERIES.land, label: "Tierra" },
                  ]}
                  data={
                    multiDay
                      ? agg.daily.map((d) => ({ label: fmtDate(d.day), tooltip: fmtWeekday(d.day), values: { water: d.water, land: d.land } }))
                      : hourlyInRange(dataset, ids, range.from, range.to, zoneSet)
                  }
                />
              </Card>
              <Card className="xl:col-span-4" title="Cómo leer estas horas" icon={ShieldQuestion}>
                <ul className="space-y-4 text-xs">
                  <Explain color={SERIES.water} title="En agua" value={fmtHours(t.water)}>
                    Tiempo entre lecturas consecutivas que indican inmersión, sumado para todos los ejemplares del filtro.
                  </Explain>
                  <Explain color={SERIES.land} title="En tierra" value={fmtHours(t.land)}>
                    Tiempo entre lecturas consecutivas en tierra, con o sin desplazamiento.
                  </Explain>
                  <Explain color={SERIES.stationary} title="Sin movimiento registrado" value={fmtHours(t.stationary)}>
                    Parte del tiempo en tierra en que las lecturas repiten la misma posición. Describe las lecturas, no afirma que el ejemplar estuviera inmóvil entre ellas.
                  </Explain>
                </ul>
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
                  ]}
                  data={agg.hourly.map((h, i) => ({ label: `${String(i).padStart(2, "0")}h`, tooltip: `${String(i).padStart(2, "0")}:00 – ${String(i).padStart(2, "0")}:59`, values: { water: h.water, land: h.land } }))}
                />
              </Card>
              <Card className="xl:col-span-7" title="Proporción en agua por día y hora" subtitle={`Últimos ${heat.days.length} días · porcentaje de lecturas en agua en cada franja`} icon={CalendarDays}>
                <Heatmap
                  rows={heat.days.map((_, i) => i)}
                  cols={Array.from({ length: 24 }, (_, i) => i)}
                  value={(r, c) => (heat.total[r][c] ? heat.water[r][c] / heat.total[r][c] : null)}
                  color="79,179,255"
                  format={(v) => `${Math.round(v * 100)}% en agua`}
                  rowLabel={(r) => `${fmtWeekday(heat.days[r])} ${new Date(heat.days[r]).getDate()}`}
                  colLabel={(c) => `${c}h`}
                />
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-12">
              <Card className="xl:col-span-8" title="Movimientos entre zonas" subtitle="Cambios de zona entre lecturas consecutivas" icon={ArrowRightLeft}>
                {transitionsTotal === 0 ? (
                  <EmptyState icon={ArrowRightLeft} title="Sin cambios de zona observados en el periodo" />
                ) : (
                  <Matrix
                    rows={zonesInMatrix}
                    cols={zonesInMatrix}
                    value={(r, c) => agg.transitions.get(`${r}>${c}`) ?? 0}
                    rowLabel={(k) => ZONE_BY_ID[k].name}
                    colLabel={(k) => ZONE_BY_ID[k].name}
                    colShort={(k) => ZONE_BY_ID[k].name.split(" ").map((w) => w[0]).join("")}
                  />
                )}
              </Card>
              <Card className="xl:col-span-4" title="Recorridos más frecuentes" icon={Route}>
                <ul className="space-y-3">
                  {topTransitions.map(([k, v]) => {
                    const [a, b] = k.split(">");
                    return (
                      <li
                        key={k}
                        onMouseMove={(e) =>
                          showTip(e, {
                            title: `${ZONE_BY_ID[a].name} → ${ZONE_BY_ID[b].name}`,
                            rows: [{ color: "var(--accent)", label: "Movimientos", value: v }],
                            note: `${Math.round((v / Math.max(1, transitionsTotal)) * 100)}% de todos los cambios de zona del periodo`,
                          })
                        }
                        onMouseLeave={hideTip}
                      >
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
    out.push({ label: fmtTime(h).slice(0, 2) + "h", tooltip: fmtDateTime(h, dataset.now), values: { water: a.water, land: a.land } });
  }
  return out;
}

function Kpi({ label, value, sub, color, className }: { label: string; value: string; sub?: string; color?: string; className?: string }) {
  return (
    <div className={cx("panel p-4", className)}>
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
  return <Legend items={[{ color: SERIES.water, label: "Agua" }, { color: SERIES.land, label: "Tierra" }]} />;
}

function CompareRows({ rows }: { rows: { key: string; label: string; color: string; ids: string[]; water: number; land: number }[] }) {
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
            title={`${r.label} · ${fmtHours(r.water)} agua, ${fmtHours(r.land)} tierra por ejemplar y día`}
            parts={[
              { value: r.water, color: SERIES.water, label: "Agua" },
              { value: r.land, color: SERIES.land, label: "Tierra" },
            ]}
          />
        </li>
      ))}
    </ul>
  );
}
