"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Clock3, MapPin, MapPinned, Radio, Users, X } from "lucide-react";
import { ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES_BY_ID } from "@/domain/species";
import { QUALITY_LABEL, SOURCE_SHORT } from "@/logic/labels";
import { computeActivity } from "@/logic/metrics";
import { fmtAgo, fmtDateTime, fmtHours } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { SimulatedTag, cx } from "@/components/ui/primitives";
import { SERIES, StackedColumns } from "@/components/charts/Charts";
import { PenguinIllustration } from "@/components/penguin/PenguinIllustration";
import { StatusPill } from "@/components/penguin/StatusPill";
import { MovementHistory } from "@/components/penguin/MovementHistory";

type Tab = "summary" | "activity" | "history" | "care";
const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "activity", label: "Activity" },
  { id: "history", label: "History" },
  { id: "care", label: "Care" },
];

/** Side panel of a species list: the essentials without leaving the table. */
export function SpeciesPenguinPanel({ penguinId, from, to, rangeLabel, onClose, className }: {
  penguinId: string;
  from: number;
  to: number;
  rangeLabel: string;
  onClose: () => void;
  className?: string;
}) {
  const { dataset, penguinById, snapshots, teamOf, userNotes, now } = useDemo();
  const [tab, setTab] = useState<Tab>("summary");
  const p = penguinById.get(penguinId)!;
  const sp = SPECIES_BY_ID[p.speciesId];
  const snap = snapshots.get(penguinId)!;
  const team = dataset.teams.find((x) => x.id === teamOf(penguinId));
  const agg = useMemo(() => computeActivity(dataset, [penguinId], from, to), [dataset, penguinId, from, to]);
  const b = agg.totals;
  const covered = b.water + b.land;
  const pct = (v: number) => (covered ? Math.round((v / covered) * 100) : 0);
  const r = snap.reading;
  const notes = [...userNotes, ...dataset.notes].filter((n) => n.penguinId === penguinId).sort((a, c) => c.at - a.at);

  return (
    <aside className={cx("slide-in panel flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden !bg-panel-solid", className)}>
      <div className="relative h-36 shrink-0 overflow-hidden border-b border-line" style={{ background: `radial-gradient(circle at 70% 30%, ${sp.color}33, transparent 70%), #0b2236` }}>
        <div className="absolute inset-0 grid place-items-center">
          <PenguinIllustration speciesId={p.speciesId} size={112} framed={false} />
        </div>
        <span className="absolute bottom-2 left-3 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/70">Representative image of the species</span>
        <button onClick={onClose} className="absolute right-2 top-2 rounded-lg bg-black/30 p-1.5 text-white/80 hover:bg-black/50" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="shrink-0 px-4 pt-3">
        <p className="font-mono text-xl font-semibold">{p.id}</p>
        <p className="text-sm text-muted">{p.name ?? "No name on record"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill status={snap.status} />
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: sp.color }} /> {sp.nameEn}
          </span>
        </div>
        <div className="mt-3 flex gap-1 border-b border-line">
          {TABS.map((x) => (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={cx("-mb-px border-b-2 px-2 pb-2 text-xs font-medium transition", tab === x.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm">
        {tab === "summary" && (
          <div className="space-y-3">
            <Line icon={MapPin} k="Last recorded zone" v={r ? ZONE_BY_ID[r.zoneId].name : "No data"} />
            <Line icon={Users} k="Responsible team" v={team?.name ?? "Unassigned"} />
            <Line icon={Clock3} k="Last reading" v={r ? `${fmtDateTime(r.timestamp, now)} · ${fmtAgo(r.timestamp, now)}` : "No data"} />
            <Line icon={Radio} k="Source · quality" v={r ? `${SOURCE_SHORT[r.source]} · ${QUALITY_LABEL[r.quality]} (±${r.accuracyM} m)` : "No data"} />
            <div className="space-y-2.5 rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted">Time recorded · {rangeLabel.toLowerCase()}</p>
                <SimulatedTag />
              </div>
              {b.readings === 0 ? (
                <p className="text-xs text-faint">No data in this period.</p>
              ) : (
                <>
                  <Meter label="In water" value={b.water} pct={pct(b.water)} color={SERIES.water} />
                  <Meter label="On land" value={b.land} pct={pct(b.land)} color="#f5b84b" />
                </>
              )}
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div>
            <p className="mb-2 text-[11px] text-muted">Recorded hours by hour of day · {rangeLabel.toLowerCase()}</p>
            <StackedColumns
              height={110}
              labelEvery={6}
              format={fmtHours}
              series={[
                { key: "water", color: SERIES.water, label: "Water" },
                { key: "land", color: SERIES.land, label: "Land" },
              ]}
              data={agg.hourly.map((h, i) => ({ label: `${i}h`, tooltip: `${String(i).padStart(2, "0")}:00`, values: { water: h.water, land: h.land } }))}
            />
            <dl className="mt-4 space-y-1.5 text-xs">
              <Pair k="Readings in period" v={String(b.readings)} />
              <Pair k="No movement recorded (on land)" v={fmtHours(b.stationary)} />
            </dl>
            <p className="mt-3 text-[10px] text-faint">Water or land per the immersion sensor (simulated). A difference in activity does not by itself indicate a health problem.</p>
          </div>
        )}

        {tab === "history" && <MovementHistory penguinId={penguinId} from={from} to={to} limit={14} />}

        {tab === "care" && (
          <div className="space-y-4">
            <div>
              <p className="eyebrow mb-1.5">Recent observations</p>
              {notes.length === 0 ? (
                <p className="text-xs text-faint">No observations.</p>
              ) : (
                <ul className="space-y-2">
                  {notes.slice(0, 4).map((n) => (
                    <li key={n.id} className="border-l-2 border-line-strong pl-2.5 text-xs">
                      <p>{n.text}</p>
                      <p className="text-[11px] text-faint">
                        {n.by} · {fmtDateTime(n.at, now)}
                        {n.simulated ? " · fictional" : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-line p-3">
        <Link
          href={`/penguins/${p.id}`}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/10 text-sm font-semibold text-ink transition hover:bg-accent/20"
        >
          View full profile <ArrowRight size={15} />
        </Link>
        {r && (
          <Link href={`/map?penguin=${p.id}`} className="flex h-8 items-center justify-center gap-1.5 text-xs text-muted hover:text-ink" title="Centers the map on the last recorded location">
            <MapPinned size={13} /> Center on map (last recorded location)
          </Link>
        )}
      </div>
    </aside>
  );
}

function Line({ icon: Icon, k, v }: { icon: typeof MapPin; k: string; v: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={15} className="shrink-0 text-faint" />
      <span className="flex-1 text-xs text-muted">{k}</span>
      <span className="text-right text-xs font-medium text-ink">{v}</span>
    </div>
  );
}

function Meter({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="num">
          {fmtHours(value)} <span className="text-faint">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
}
