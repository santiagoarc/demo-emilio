"use client";

import { Droplets, Mountain, PauseCircle } from "lucide-react";
import { ZONE_BY_ID } from "@/domain/habitat";
import { fmtDateTime, fmtTime } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";

/** Stretches by zone, newest first. */
export function MovementHistory({ penguinId, from, to, limit = 12 }: { penguinId: string; from: number; to: number; limit?: number }) {
  const { dataset, now } = useDemo();
  const recs = (dataset.activity.get(penguinId) ?? [])
    .filter((r) => r.end > from && r.start < to)
    .sort((a, b) => b.start - a.start)
    .slice(0, limit);

  if (!recs.length) return <p className="py-4 text-center text-xs text-muted">No movements recorded in this period.</p>;

  return (
    <ol className="relative space-y-1 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-line-strong">
      {recs.map((r) => {
        const z = ZONE_BY_ID[r.zoneId];
        const Icon = r.medium === "water" ? Droplets : r.stationary && r.readings > 1 ? PauseCircle : Mountain;
        return (
          <li key={`r${r.start}`} className="relative flex gap-3 rounded-lg px-1 py-1.5">
            <span className="z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line-strong bg-panel-solid">
              <Icon size={13} color={r.medium === "water" ? "#4fb3ff" : "#9fb4c7"} />
            </span>
            <div className="min-w-0 text-xs">
              <p className="text-ink">
                {z.name}
                {r.stationary && r.readings > 1 && <span className="ml-1.5 text-faint">· no movement recorded</span>}
              </p>
              <p className="text-faint">
                {fmtDateTime(r.start, now)} – {Math.min(r.end, to) >= now ? "now" : fmtTime(Math.min(r.end, to))} · {r.readings} reading{r.readings === 1 ? "" : "s"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
