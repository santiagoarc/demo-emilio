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

  // The heatmap always shows the last week, whatever period is chosen:
  // with "24 h" it would only have one or two rows.
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
  const bySpecies = groupRows(SPECIES.map((s) => ({ key: s.id, label: s.nameEn, color: s.color, ids: visible.filter((p) => p.speciesId === s.id).map((p) => p.id) }))).filter((g) => g.ids.length);
  const byTeam = groupRows(dataset.teams.map((tm) => ({ key: tm.id, label: tm.name, color: tm.color, ids: visible.filter((p) => teamOf(p.id) === tm.id).map((p) => p.id) }))).filter((g) => g.ids.length);

  // Only zones with some movement, so the table has no empty rows.
  const zonesInMatrix = PENGUIN_ZONES.map((z) => z.id).filter((z) => [...agg.transitions.keys()].some((k) => k.split(">").includes(z)));
  const topTransitions = [...agg.transitions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const transitionsTotal = [...agg.transitions.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Analytics"
        title="Activity Analytics"
        subtitle="Every chart is computed from the readings and responds to the filters."
      />
      <div className="space-y-5 px-6 lg:px-8">
        <div className="panel-flat p-4">
          <GlobalFilters showPenguin />
        </div>

        {n === 0 || range.to <= range.from ? (
          <Card>
            <EmptyState icon={Activity} title={n === 0 ? "No penguins match the filters" : "The date range is empty"}>
              {n === 0 ? "Adjust species, team, penguin or zone." : "Pick an end date after the start date, within the available history."}
            </EmptyState>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi className="col-span-2 lg:col-span-1" label="Penguins analyzed" value={String(n)} />
              <Kpi label="Hours in water" value={fmtHours(t.water)} color={SERIES.water} sub={`${fmtHours(perPenguinPerDay(t.water, n, range.from, range.to))} per penguin/day`} />
              <Kpi label="Hours on land" value={fmtHours(t.land)} color={SERIES.land} sub={`${fmtHours(perPenguinPerDay(t.land, n, range.from, range.to))} per penguin/day`} />
              <Kpi label="No movement recorded" value={fmtHours(t.stationary)} color={SERIES.stationary} sub="repeated readings on land" />
              <Kpi label="Zone changes" value={String(transitionsTotal)} sub="between consecutive readings" />
            </div>

            <div className="grid gap-5 xl:grid-cols-12">
              <Card className="xl:col-span-8" title="Time in water vs. time on land" subtitle={`${range.label} · penguin-hours per ${multiDay ? "day" : "hour"}`} icon={Droplets}
                action={<Legend items={[{ color: SERIES.water, label: "Water" }, { color: SERIES.land, label: "Land" }]} />}>
                <StackedColumns
                  height={210}
                  labelEvery={multiDay ? 1 : 3}
                  format={fmtHours}
                  series={[
                    { key: "water", color: SERIES.water, label: "Water" },
                    { key: "land", color: SERIES.land, label: "Land" },
                  ]}
                  data={
                    multiDay
                      ? agg.daily.map((d) => ({ label: fmtDate(d.day), tooltip: fmtWeekday(d.day), values: { water: d.water, land: d.land } }))
                      : hourlyInRange(dataset, ids, range.from, range.to, zoneSet)
                  }
                />
              </Card>
              <Card className="xl:col-span-4" title="How to read these hours" icon={ShieldQuestion}>
                <ul className="space-y-4 text-xs">
                  <Explain color={SERIES.water} title="In water" value={fmtHours(t.water)}>
                    Time between consecutive readings that indicate immersion, summed across all penguins in the filter.
                  </Explain>
                  <Explain color={SERIES.land} title="On land" value={fmtHours(t.land)}>
                    Time between consecutive readings on land, with or without movement.
                  </Explain>
                  <Explain color={SERIES.stationary} title="No movement recorded" value={fmtHours(t.stationary)}>
                    The part of time on land where readings repeat the same position. It describes the readings; it does not claim the penguin was motionless between them.
                  </Explain>
                </ul>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-12">
              <Card className="xl:col-span-5" title="Activity by hour of day" subtitle="Period total for each hour slot" icon={Clock}>
                <StackedColumns
                  height={190}
                  labelEvery={3}
                  format={fmtHours}
                  series={[
                    { key: "water", color: SERIES.water, label: "Water" },
                    { key: "land", color: SERIES.land, label: "Land" },
                  ]}
                  data={agg.hourly.map((h, i) => ({ label: `${String(i).padStart(2, "0")}h`, tooltip: `${String(i).padStart(2, "0")}:00 – ${String(i).padStart(2, "0")}:59`, values: { water: h.water, land: h.land } }))}
                />
              </Card>
              <Card className="xl:col-span-7" title="Share in water by day and hour" subtitle={`Last ${heat.days.length} days · share of readings in water in each slot`} icon={CalendarDays}>
                <Heatmap
                  rows={heat.days.map((_, i) => i)}
                  cols={Array.from({ length: 24 }, (_, i) => i)}
                  value={(r, c) => (heat.total[r][c] ? heat.water[r][c] / heat.total[r][c] : null)}
                  color="79,179,255"
                  format={(v) => `${Math.round(v * 100)}% in water`}
                  rowLabel={(r) => fmtWeekday(heat.days[r])}
                  colLabel={(c) => `${c}h`}
                />
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-12">
              <Card className="xl:col-span-8" title="Movement between zones" subtitle="Zone changes between consecutive readings" icon={ArrowRightLeft}>
                {transitionsTotal === 0 ? (
                  <EmptyState icon={ArrowRightLeft} title="No zone changes observed in this period" />
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
              <Card className="xl:col-span-4" title="Most frequent routes" icon={Route}>
                <ul className="space-y-3">
                  {topTransitions.map(([k, v]) => {
                    const [a, b] = k.split(">");
                    return (
                      <li
                        key={k}
                        onMouseMove={(e) =>
                          showTip(e, {
                            title: `${ZONE_BY_ID[a].name} → ${ZONE_BY_ID[b].name}`,
                            rows: [{ color: "var(--accent)", label: "Moves", value: v }],
                            note: `${Math.round((v / Math.max(1, transitionsTotal)) * 100)}% of all zone changes in the period`,
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
                  {topTransitions.length === 0 && <li className="text-xs text-muted">No data.</li>}
                </ul>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card title="Comparison by species" subtitle="Average per penguin per day" icon={Bird} action={<CompareLegend />}>
                <CompareRows rows={bySpecies} />
              </Card>
              <Card title="Comparison by team" subtitle="Average per penguin per day" icon={Users} action={<CompareLegend />}>
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
  return <Legend items={[{ color: SERIES.water, label: "Water" }, { color: SERIES.land, label: "Land" }]} />;
}

function CompareRows({ rows }: { rows: { key: string; label: string; color: string; ids: string[]; water: number; land: number }[] }) {
  if (!rows.length) return <p className="text-xs text-muted">No data.</p>;
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
              <b className="text-ink">{fmtHours(r.water)}</b> water · <b className="text-ink">{fmtHours(r.land)}</b> land
            </span>
          </div>
          <SplitBar
            title={`${r.label} · ${fmtHours(r.water)} water, ${fmtHours(r.land)} land per penguin per day`}
            parts={[
              { value: r.water, color: SERIES.water, label: "Water" },
              { value: r.land, color: SERIES.land, label: "Land" },
            ]}
          />
        </li>
      ))}
    </ul>
  );
}
