"use client";

import { CloudOff, Clock3, Droplets, Mountain, PauseCircle } from "lucide-react";
import { ZONE_BY_ID } from "@/domain/habitat";
import type { ActivityRecord, ReadingGap } from "@/domain/types";
import { fmtDateTime, fmtTime, MIN } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";

type Item = { kind: "rec"; r: ActivityRecord } | { kind: "gap"; g: ReadingGap };

/** Tramos por zona y huecos de lectura, del más reciente al más antiguo. */
export function MovementHistory({ penguinId, from, to, limit = 12 }: { penguinId: string; from: number; to: number; limit?: number }) {
  const { dataset, now } = useDemo();
  const recs = (dataset.activity.get(penguinId) ?? []).filter((r) => r.end > from && r.start < to);
  const gaps = (dataset.gaps.get(penguinId) ?? []).filter((g) => g.end > from && g.start < to);
  const items: Item[] = [...recs.map((r) => ({ kind: "rec" as const, r })), ...gaps.map((g) => ({ kind: "gap" as const, g }))]
    .sort((a, b) => (b.kind === "rec" ? b.r.start : b.g.start) - (a.kind === "rec" ? a.r.start : a.g.start))
    .slice(0, limit);

  if (!items.length) return <p className="py-4 text-center text-xs text-muted">Sin lecturas ni huecos registrados en este periodo.</p>;

  return (
    <ol className="relative space-y-1 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-line-strong">
      {items.map((it) => {
        if (it.kind === "gap") {
          const off = it.g.kind === "no_comm";
          const Icon = off ? CloudOff : Clock3;
          const end = Math.min(it.g.end, to);
          return (
            <li key={`g${it.g.start}`} className="relative flex gap-3 rounded-lg px-1 py-1.5">
              <span className="z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-dashed" style={{ borderColor: off ? "#ff6b6b80" : "#f5b84b80", background: "var(--panel-solid)" }}>
                <Icon size={13} color={off ? "#ff6b6b" : "#f5b84b"} />
              </span>
              <div className="min-w-0 text-xs">
                <p className={off ? "text-danger" : "text-warn"}>{off ? "Sin comunicación del dispositivo" : "Sin posición (dispositivo comunicando)"}</p>
                <p className="text-faint">
                  {fmtDateTime(it.g.start, now)} – {end >= now ? "ahora" : fmtTime(end)} · {Math.round((end - it.g.start) / MIN)} min sin lectura
                </p>
              </div>
            </li>
          );
        }
        const r = it.r;
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
                {r.stationary && r.readings > 1 && <span className="ml-1.5 text-faint">· sin movimiento registrado</span>}
              </p>
              <p className="text-faint">
                {fmtDateTime(r.start, now)} – {Math.min(r.end, to) >= now ? "ahora" : fmtTime(Math.min(r.end, to))} · {r.readings} lectura{r.readings === 1 ? "" : "s"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
