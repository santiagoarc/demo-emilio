"use client";

import { useMemo, type ReactNode } from "react";
import { Footprints, MoveUpRight, Plane, Ruler, Timer, TreePine, TrendingUp, Wind } from "lucide-react";
import type { MonitorBird } from "@/domain/aviaryTracking";
import { birdInsight, flightByDay, flightSpeed, flightStats, fmtDistance, speciesFlightBaseline } from "@/logic/aviaryActivity";
import { DAY, HOUR, MIN, fmtHours } from "@/logic/time";
import { useTracking } from "@/state/useTracking";
import { cx } from "@/components/ui/primitives";
import { SplitBar } from "@/components/charts/Charts";
import { InsightBadge } from "@/features/health/HealthCards";

const COLORS = { flying: "#2563eb", walking: "#c7850c", perched: "#16a34a", ground: "#9fb4c7" };

const fmtMin = (m: number) => (m >= 90 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);
const fmtDur = (ms: number) => (ms >= HOUR ? fmtHours(ms) : ms >= MIN ? `${Math.round(ms / MIN)} min` : `${Math.round(ms / 1000)} s`);

/** "How is it doing?" for a bird, plus its flight time and distances over the chosen window. */
export function BirdActivity({ bird, asOf, windowMs, windowLabel, control }: {
  bird: MonitorBird;
  asOf: number;
  windowMs: number;
  windowLabel: string;
  /** Window selector, shown above the figures. */
  control: ReactNode;
}) {
  const { ds } = useTracking();
  // Recomputed every 5 simulated minutes, not on every clock tick.
  const at = Math.floor(asOf / (5 * MIN)) * 5 * MIN;
  const stays = ds.stays.get(bird.id);
  const species = useMemo(() => speciesFlightBaseline(ds, bird.speciesId, at), [ds, bird.speciesId, at]);
  const ins = useMemo(() => birdInsight(ds, bird, at, species), [ds, bird, at, species]);
  const s = useMemo(() => flightStats(bird, stays ?? [], Math.max(ds.windowStart, at - windowMs), at), [bird, stays, ds.windowStart, at, windowMs]);
  const days = useMemo(() => flightByDay(bird, stays ?? [], ds.windowStart, at), [bird, stays, ds.windowStart, at]);
  const speed = flightSpeed(s);
  const maxDay = Math.max(1, ...days.map((d) => d.flyingMin), species?.flyingMin ?? 0);

  const bar = (label: string, mine: number, ref: number | null, fmt: (v: number) => string) => {
    const max = Math.max(mine, ref ?? 0, 0.1);
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-muted">
          <span>{label}</span>
          <span className="num">
            <b className="font-semibold text-ink">{fmt(mine)}</b>
            {ref != null && <> · species {fmt(ref)}</>}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-ink/[0.06]">
          <div className="h-2 rounded-full" style={{ width: `${(mine / max) * 100}%`, background: COLORS.flying }} />
          {ref != null && <div className="absolute -top-0.5 h-3 w-0.5 rounded bg-ink/60" style={{ left: `calc(${(ref / max) * 100}% - 1px)` }} title="Species daily average" />}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 space-y-4">
      <div>
        <p className="eyebrow mb-2">How is it doing?</p>
        <div className="flex flex-wrap items-center gap-2">
          <InsightBadge level={ins.level} />
          <span className="text-sm font-medium text-ink">{ins.headline}</span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {ins.points.map((pt, i) => (
            <li key={i} className="flex gap-2 text-xs text-muted">
              <span className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", pt.level === "ok" ? "bg-ok" : pt.level === "watch" ? "bg-warn" : "bg-danger")} />
              {pt.text}
            </li>
          ))}
        </ul>
        {s.measurable && (
          <div className="mt-3 space-y-2.5">
            {bar("Time flying · last 24 h", ins.today.flyingMin, species?.flyingMin ?? null, fmtMin)}
            {bar("Distance flown · last 24 h", ins.today.flownM, species?.flownM ?? null, fmtDistance)}
            <p className="text-[11px] text-faint">
              The tick marks the species&rsquo; daily average{ins.before ? ` · its own previous days: ${fmtMin(ins.before.flyingMin)} and ${fmtDistance(ins.before.flownM)} per day` : ""}.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-2">{control}</div>
        <p className="eyebrow mb-2">Time recorded · {windowLabel}</p>
        {!s.measurable ? (
          <p className="rounded-lg bg-warn/[0.08] px-2.5 py-2 text-[11px] text-ink">Zone-only device: there are no positions, so flight time and distances are not shown. No figures are invented.</p>
        ) : (
          <>
            <SplitBar
              title={`Time · ${windowLabel}`}
              parts={[
                { value: s.flyingMs, color: COLORS.flying, label: "Flying" },
                { value: s.walkingMs, color: COLORS.walking, label: "Walking" },
                { value: s.perchedMs, color: COLORS.perched, label: "Perched in trees" },
                { value: s.groundMs, color: COLORS.ground, label: "On the ground" },
              ]}
            />
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {(
                [
                  ["Flying", s.flyingMs, COLORS.flying],
                  ["Walking", s.walkingMs, COLORS.walking],
                  ["In trees", s.perchedMs, COLORS.perched],
                  ["On ground", s.groundMs, COLORS.ground],
                ] as const
              ).map(([label, ms, color]) => (
                <p key={label} className="flex items-center text-muted">
                  <span className="mr-1.5 inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
                  {label}
                  <span className="num ml-auto font-semibold text-ink">{fmtDur(ms)}</span>
                </p>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Kpi icon={<Ruler size={13} />} label="Distance flown" value={fmtDistance(s.flownM)} hint={`${s.flights} flights`} />
              <Kpi icon={<Footprints size={13} />} label="Distance walked" value={fmtDistance(s.walkedM)} hint={`${s.walks} walks`} />
              <Kpi icon={<MoveUpRight size={13} />} label="Longest flight" value={s.flights ? fmtDistance(s.longestFlightM) : "—"} hint={s.flights ? fmtDur(s.longestFlightMs) : undefined} />
              <Kpi icon={<Wind size={13} />} label="Average flight speed" value={speed != null ? `${speed.toFixed(1)} m/s` : "—"} hint={speed != null ? `${(speed * 3.6).toFixed(1)} km/h` : undefined} />
              <Kpi icon={<TrendingUp size={13} />} label="Highest point" value={`${s.maxHeightM.toFixed(1)} m`} />
              <Kpi icon={<TreePine size={13} />} label="Trees · zones visited" value={`${s.treesVisited} · ${s.zonesVisited}`} />
            </div>
            {s.coverage < 0.95 && <p className="mt-2 text-[11px] text-warn">Readings cover {Math.round(s.coverage * 100)}% of the period: figures may be incomplete.</p>}
          </>
        )}
      </div>

      {s.measurable && days.length > 1 && (
        <div className="border-t border-line pt-3">
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <Plane size={12} /> Flying per day
          </p>
          <div className="relative flex h-24 items-end gap-1.5">
            {species && (
              <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink/40" style={{ bottom: `${(species.flyingMin / maxDay) * 100}%` }} title="Species daily average" />
            )}
            {days.map((d, i) => {
              const today = i === days.length - 1;
              return (
                <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end" title={`${fmtMin(d.flyingMin)} · ${fmtDistance(d.flownM)} · ${d.flights} flights`}>
                  <span className="num mb-0.5 text-[9px] text-muted">{Math.round(d.flyingMin)}</span>
                  <div className="w-full rounded-t" style={{ height: `${(d.flyingMin / maxDay) * 100}%`, background: COLORS.flying, opacity: today ? 0.55 : 1 }} />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-1.5">
            {days.map((d, i) => (
              <span key={d.day} className="flex-1 text-center text-[10px] text-muted">
                {i === days.length - 1 ? "Today" : new Date(d.day).toLocaleDateString("en-GB", { weekday: "short" })}
              </span>
            ))}
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-faint">
            <Timer size={11} /> Minutes in the air · dashed line = species daily average · today is still in progress.
          </p>
        </div>
      )}

      <p className="text-[11px] leading-snug text-faint">
        Inference from tracking data — not a clinical assessment. Distances follow the recorded path between positions; species average over the last {Math.round(Math.min(7, (asOf - ds.windowStart) / DAY))} days.
      </p>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-ink/[0.02] px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] text-muted">
        <span className="text-accent">{icon}</span> {label}
      </p>
      <p className="num mt-0.5 text-sm font-semibold text-ink">{value}</p>
      {hint && <p className="text-[10px] text-faint">{hint}</p>}
    </div>
  );
}
