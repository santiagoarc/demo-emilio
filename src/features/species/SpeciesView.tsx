"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Activity, ChevronRight, List, MapPinned, Users } from "lucide-react";
import { ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES } from "@/domain/species";
import { computeActivity, perPenguinPerDay, sumBreakdowns } from "@/logic/metrics";
import { fmtHours } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { PageHeader } from "@/components/shell/AppShell";
import { Segmented } from "@/components/ui/primitives";
import { SERIES, SplitBar } from "@/components/charts/Charts";
import { PenguinIllustration } from "@/components/penguin/PenguinIllustration";
import type { RangePreset } from "@/logic/filters";

export function SpeciesView() {
  const { dataset, snapshots, teamOf, filters, setFilters, range } = useDemo();

  // The cards show all six species; they honor the team and zone filters, not the species filter.
  const base = useMemo(
    () =>
      dataset.penguins.filter(
        (p) =>
          (!filters.teams.length || filters.teams.includes(teamOf(p.id))) &&
          (!filters.zones.length || filters.zones.includes(snapshots.get(p.id)?.reading?.zoneId ?? "")),
      ),
    [dataset, filters.teams, filters.zones, teamOf, snapshots],
  );
  const agg = useMemo(() => computeActivity(dataset, base.map((p) => p.id), range.from, range.to), [dataset, base, range]);

  const stats = SPECIES.map((s) => {
    const list = base.filter((p) => p.speciesId === s.id);
    const snaps = list.map((p) => snapshots.get(p.id)!);
    const zones = new Map<string, number>();
    for (const sn of snaps) if (sn.reading) zones.set(sn.reading.zoneId, (zones.get(sn.reading.zoneId) ?? 0) + 1);
    const teams = new Map<string, number>();
    for (const p of list) teams.set(teamOf(p.id), (teams.get(teamOf(p.id)) ?? 0) + 1);
    const b = sumBreakdowns(list.map((p) => agg.perPenguin.get(p.id)!).filter(Boolean));
    return {
      s,
      total: list.length,
      inWater: snaps.filter((x) => x.status === "water").length,
      onLand: snaps.filter((x) => x.status === "land" || x.status === "resting").length,
      zones: [...zones.entries()].sort((a, b) => b[1] - a[1]),
      teams: [...teams.entries()].sort((a, b) => b[1] - a[1]),
      water: perPenguinPerDay(b.water, list.length, range.from, range.to),
      land: perPenguinPerDay(b.land, list.length, range.from, range.to),
    };
  });

  const total = stats.reduce((a, x) => a + x.total, 0);
  const inWater = stats.reduce((a, x) => a + x.inWater, 0);
  const teamsInvolved = new Set(base.map((p) => teamOf(p.id))).size;

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Catalog · SeaWorld Penguin Tracking & Care"
        title="Species"
        subtitle="Explore the six species and review their population, activity and responsible teams."
        actions={
          <Segmented<RangePreset>
            size="sm"
            value={filters.range === "custom" ? "24h" : filters.range}
            onChange={(v) => setFilters({ range: v })}
            options={[
              { value: "today", label: "Today" },
              { value: "24h", label: "24 h" },
              { value: "7d", label: "7 days" },
              { value: "14d", label: "14 days" },
            ]}
          />
        }
      />
      <div className="space-y-5 px-6 lg:px-8">
        <div className="panel grid divide-line sm:grid-cols-3 sm:divide-x">
          <Kpi icon={Users} color="#5cb8ff" value={total} label="Registered penguins" />
          <Kpi icon={Activity} color="#2fd8c8" value={inWater} label="In water now" side={total ? `${Math.round((inWater / total) * 100)}%` : "—"} sideHint="of total" />
          <Kpi icon={Users} color="#a78bfa" value={teamsInvolved} label="Teams involved" side="in care" />
        </div>

        {(filters.teams.length > 0 || filters.zones.length > 0) && (
          <p className="text-xs text-muted">
            Showing only penguins from {[filters.teams.map((t) => dataset.teams.find((x) => x.id === t)?.name).join(", "), filters.zones.map((z) => ZONE_BY_ID[z].name).join(", ")].filter(Boolean).join(" · ")}.{" "}
            <button className="text-accent hover:underline" onClick={() => setFilters({ teams: [], zones: [] })}>Remove</button>
          </p>
        )}

        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {stats.map((x, i) => (
            <article key={x.s.id} className="panel fade-up flex flex-col overflow-hidden" style={{ animationDelay: `${i * 50}ms` }}>
              <Link href={`/species/${x.s.id}`} className="group relative flex items-center gap-4 border-b border-line p-4 transition hover:bg-ink/[0.02]">
                <div className="absolute inset-y-0 right-0 w-1/2 opacity-[0.08]" style={{ background: `radial-gradient(circle at 80% 40%, ${x.s.color}, transparent 70%)` }} />
                <PenguinIllustration speciesId={x.s.id} size={76} />
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.s.color }} />
                    {x.s.nameEn}
                  </h2>
                  <p className="text-[11px] italic text-faint">{x.s.scientific}</p>
                </div>
                <ChevronRight size={18} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
              <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
                <Mini label="Registered" value={String(x.total)} />
                <Mini label="In water" value={String(x.inWater)} />
                <Mini label="On land" value={String(x.onLand)} />
              </div>
              <div className="space-y-3.5 p-4">
                <div>
                  <p className="mb-1.5 text-[11px] text-muted">Average time per day · {range.label.toLowerCase()}</p>
                  <SplitBar
                    parts={[
                      { value: x.water, color: SERIES.water, label: "Water" },
                      { value: x.land, color: SERIES.land, label: "Land" },
                    ]}
                  />
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <Dot color={SERIES.water}>Water <b className="num text-ink">{fmtHours(x.water)}</b></Dot>
                    <Dot color={SERIES.land}>Land <b className="num text-ink">{fmtHours(x.land)}</b></Dot>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] text-muted">Distribution by zone (last location)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {x.zones.length === 0 && <span className="text-xs text-faint">No data.</span>}
                    {x.zones.slice(0, 3).map(([z, n]) => (
                      <span key={z} className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted">
                        {ZONE_BY_ID[z].name} <b className="num ml-0.5 text-ink">{n}</b>
                      </span>
                    ))}
                    {x.zones.length > 3 && <span className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-faint">+{x.zones.length - 3}</span>}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] text-muted">Responsible teams</p>
                  <div className="flex flex-wrap gap-1.5">
                    {x.teams.map(([t, n]) => {
                      const team = dataset.teams.find((y) => y.id === t);
                      return (
                        <span key={t} className="inline-flex items-center gap-1.5 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: team?.color ?? "#56718a" }} />
                          {team?.name ?? "Unassigned"} <b className="num text-ink">{n}</b>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-auto grid grid-cols-2 gap-2 border-t border-line p-3">
                <Link
                  href={`/species/${x.s.id}`}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 text-xs font-medium text-ink transition hover:bg-accent/20"
                >
                  <List size={13} /> View penguins
                </Link>
                <Link
                  href={`/map?species=${x.s.id}`}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-xs font-medium text-muted transition hover:text-ink"
                >
                  <MapPinned size={13} /> View on map
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, color, value, label, side, sideHint }: { icon: typeof Users; color: string; value: number; label: string; side?: string; sideHint?: string }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${color}1f`, color }}>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="num text-2xl font-semibold leading-tight">{value}</p>
        <p className="truncate text-xs text-muted">{label}</p>
      </div>
      {side && (
        <div className="text-right">
          <p className="num text-sm font-semibold text-ok">{side}</p>
          {sideHint && <p className="text-[10px] text-faint">{sideHint}</p>}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="num text-xl font-semibold">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

function Dot({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}
