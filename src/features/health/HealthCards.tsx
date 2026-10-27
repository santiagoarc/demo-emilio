"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, CircleAlert, Eye, HeartPulse, MessageSquareText, Plus, Scale } from "lucide-react";
import type { HealthCase, HealthReason } from "@/domain/types";
import { INSIGHT_LABEL, type InsightLevel } from "@/logic/insights";
import { fmtAgo, fmtDateTime, DAY } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { Badge, Button, Select, cx } from "@/components/ui/primitives";
import { askChat } from "@/features/chat/ask";

export const REASON_LABEL: Record<HealthReason, string> = {
  injury: "Injury or limp",
  weight: "Weight",
  molt: "Molt",
  treatment: "Treatment",
  behavior: "Behavior",
  other: "Other",
};

export const LEVEL_TONE: Record<InsightLevel, "ok" | "warn" | "danger"> = { ok: "ok", watch: "warn", check: "danger" };
const LEVEL_ICON = { ok: CheckCircle2, watch: Eye, check: CircleAlert };

export function InsightBadge({ level }: { level: InsightLevel }) {
  const Icon = LEVEL_ICON[level];
  return (
    <Badge tone={LEVEL_TONE[level]}>
      <Icon size={11} /> {INSIGHT_LABEL[level]}
    </Badge>
  );
}

/** Activity check: verdict, reasons in numbers, and water/land time vs. the species. */
export function InsightCard({ penguinId, compact }: { penguinId: string; compact?: boolean }) {
  const { insights, penguinById } = useDemo();
  const ins = insights.get(penguinId);
  const p = penguinById.get(penguinId);
  if (!ins || !p) return null;
  const max = Math.max(ins.water.mine, ins.water.species, ins.land.mine, ins.land.species, 0.1);
  const bar = (label: string, mine: number, species: number, color: string) => (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span className="num">
          <b className="font-semibold text-ink">{mine.toFixed(1)} h</b> · species {species.toFixed(1)} h
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-ink/[0.06]">
        <div className="h-2 rounded-full" style={{ width: `${(mine / max) * 100}%`, background: color }} />
        <div className="absolute -top-0.5 h-3 w-0.5 rounded bg-ink/60" style={{ left: `calc(${(species / max) * 100}% - 1px)` }} title="Species average" />
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <InsightBadge level={ins.level} />
        <span className="text-sm font-medium text-ink">{ins.headline}</span>
      </div>
      <ul className="space-y-1.5">
        {ins.points.map((pt, i) => (
          <li key={i} className="flex gap-2 text-xs text-muted">
            <span className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", pt.level === "ok" ? "bg-ok" : pt.level === "watch" ? "bg-warn" : "bg-danger")} />
            {pt.text}
          </li>
        ))}
      </ul>
      {!compact && (
        <div className="space-y-2.5 pt-1">
          {bar("Water · last 24 h", ins.water.mine, ins.water.species, "#2b7fd0")}
          {bar("Land · last 24 h", ins.land.mine, ins.land.species, "#c7850c")}
          <p className="text-[11px] text-faint">The tick marks the species&rsquo; daily average.</p>
        </div>
      )}
      <p className="text-[11px] leading-snug text-faint">Inference from simulated activity data — not a clinical assessment.</p>
      <Button size="sm" variant="outline" onClick={() => askChat(`Give me the full report on ${p.id}: how its activity looks, what changed and what's worth watching.`)}>
        <MessageSquareText size={13} /> Ask for a full report
      </Button>
    </div>
  );
}

const lastWeight = (c: HealthCase) => c.entries.find((e) => e.weightKg !== undefined)?.weightKg;
const firstWeight = (c: HealthCase) => [...c.entries].reverse().find((e) => e.weightKg !== undefined)?.weightKg;

/** A case with its log; lets you record progress and close it. */
export function CaseCard({ hc, showPenguin, expandedByDefault }: { hc: HealthCase; showPenguin?: React.ReactNode; expandedByDefault?: boolean }) {
  const { addCaseEntry, closeCase, now } = useDemo();
  const [text, setText] = useState("");
  const [weight, setWeight] = useState("");
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(!!expandedByDefault);
  const w1 = lastWeight(hc);
  const w0 = firstWeight(hc);
  const open = hc.status === "open";
  const days = Math.max(1, Math.round(((hc.closedAt ?? now) - hc.openedAt) / DAY));
  const entries = expanded ? hc.entries : hc.entries.slice(0, 3);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    const kg = weight ? Number(weight) : undefined;
    if (closing) closeCase(hc.id, t);
    else if (t || kg !== undefined) addCaseEntry(hc.id, t || "Weigh-in recorded.", kg !== undefined && !Number.isNaN(kg) ? kg : undefined);
    setText("");
    setWeight("");
    setClosing(false);
  };

  return (
    <div className={cx("rounded-xl border p-4", open ? "border-line-strong bg-panel-solid" : "border-line bg-ink/[0.02]")}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          {showPenguin}
          <p className="text-sm font-semibold text-ink">{hc.title}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {REASON_LABEL[hc.reason]} · owner {hc.owner} · {open ? `opened ${days} ${days === 1 ? "day" : "days"} ago` : `closed ${fmtDateTime(hc.closedAt!, now)} (${days} ${days === 1 ? "day" : "days"})`}
          </p>
        </div>
        <Badge tone={open ? "accent" : "neutral"}>{open ? "Open" : "Closed"}</Badge>
      </div>

      {w1 !== undefined && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-ink/[0.04] px-2 py-1 text-xs text-ink">
          <Scale size={12} className="text-muted" /> {w1.toFixed(2)} kg
          {w0 !== undefined && w0 !== w1 && (
            <span className={cx("num", w1 > w0 ? "text-ok" : "text-warn")}>
              ({w1 > w0 ? "+" : ""}
              {(w1 - w0).toFixed(2)} kg since start)
            </span>
          )}
        </p>
      )}

      <ol className="mt-3 space-y-2 border-l border-line pl-3">
        {entries.map((e) => (
          <li key={e.id} className="text-xs">
            <p className="text-[11px] text-faint">
              {fmtDateTime(e.at, now)} · {e.by}
              {e.weightKg !== undefined && ` · ${e.weightKg.toFixed(2)} kg`}
            </p>
            <p className="text-ink">{e.text}</p>
          </li>
        ))}
      </ol>
      {hc.entries.length > 3 && (
        <button onClick={() => setExpanded(!expanded)} className="mt-1 text-[11px] text-accent hover:underline">
          {expanded ? "Show less" : `Show all ${hc.entries.length} entries`}
        </button>
      )}

      {open && (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={closing ? "How it was resolved (optional)" : "Log progress: what was observed, what was done…"}
            className="w-full resize-none rounded-lg border border-line-strong bg-panel-solid px-2.5 py-2 text-xs text-ink outline-none placeholder:text-faint focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-2">
            {!closing && (
              <label className="flex items-center gap-1.5 text-[11px] text-muted">
                <Scale size={12} />
                <input
                  value={weight}
                  onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  placeholder="kg"
                  className="h-7 w-16 rounded-md border border-line-strong bg-panel-solid px-2 text-xs text-ink outline-none focus:border-accent"
                />
              </label>
            )}
            <span className="flex-1" />
            <Button type="button" size="sm" variant="ghost" onClick={() => setClosing(!closing)}>
              {closing ? "Cancel" : "Close case"}
            </Button>
            <Button type="submit" size="sm" variant="primary" disabled={!closing && !text.trim() && !weight}>
              {closing ? "Confirm close" : "Log entry"}
            </Button>
          </div>
        </form>
      )}
      <p className="mt-2 text-[10px] text-faint">Updated {fmtAgo(hc.entries[0]?.at ?? hc.openedAt, now)}</p>
    </div>
  );
}

/** Form to start a health follow-up for a penguin. */
export function NewCaseForm({ penguinId, onDone }: { penguinId?: string; onDone: (caseId?: string) => void }) {
  const { dataset, openCase, teamOf } = useDemo();
  const [pid, setPid] = useState(penguinId ?? "");
  const [reason, setReason] = useState<HealthReason>("injury");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [weight, setWeight] = useState("");
  const team = dataset.teams.find((t) => t.id === teamOf(pid));
  const vet = dataset.teams.find((t) => t.id === "vet");
  const owners = [...new Set([...(team?.members ?? []), ...(vet?.members ?? [])])];
  const [owner, setOwner] = useState("");
  const field = "w-full rounded-lg border border-line-strong bg-panel-solid px-2.5 text-sm text-ink outline-none focus:border-accent";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!pid || !title.trim()) return;
    const kg = weight ? Number(weight) : undefined;
    const id = openCase({
      penguinId: pid,
      reason,
      title: title.trim(),
      owner: owner || team?.lead || "Care team",
      text: text.trim() || "Case opened.",
      weightKg: kg !== undefined && !Number.isNaN(kg) ? kg : undefined,
    });
    onDone(id);
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-accent/40 bg-accent/[0.04] p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <HeartPulse size={15} className="text-accent" /> New health follow-up
      </p>
      {!penguinId && (
        <label className="block text-[11px] text-muted">
          Penguin
          <Select value={pid} onChange={(e) => setPid(e.target.value)} className={cx(field, "mt-1 h-9")}>
            <option value="">Choose a penguin…</option>
            {dataset.penguins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
                {p.name ? ` · ${p.name}` : ""}
              </option>
            ))}
          </Select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[11px] text-muted">
          Reason
          <Select value={reason} onChange={(e) => setReason(e.target.value as HealthReason)} className={cx(field, "mt-1 h-9")}>
            {(Object.keys(REASON_LABEL) as HealthReason[]).map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-[11px] text-muted">
          Owner
          <Select value={owner} onChange={(e) => setOwner(e.target.value)} className={cx(field, "mt-1 h-9")}>
            <option value="">{team?.lead ? `${team.lead} (team lead)` : "Care team"}</option>
            {owners.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <label className="block text-[11px] text-muted">
        What is being followed
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Limp, right foot" className={cx(field, "mt-1 h-9")} />
      </label>
      <label className="block text-[11px] text-muted">
        First observation
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className={cx(field, "mt-1 resize-none py-2")} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-muted">
          <Scale size={12} /> Weight
          <input value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="kg" className="h-8 w-20 rounded-md border border-line-strong bg-panel-solid px-2 text-xs text-ink outline-none focus:border-accent" />
        </label>
        <span className="flex-1" />
        <Button type="button" size="sm" variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" size="sm" variant="primary" disabled={!pid || !title.trim()}>
          <Plus size={13} /> Open follow-up
        </Button>
      </div>
    </form>
  );
}

/** Health block on a profile: activity check and follow-up cases. */
export function PenguinHealth({ penguinId }: { penguinId: string }) {
  const { cases } = useDemo();
  const [adding, setAdding] = useState(false);
  const mine = cases.filter((c) => c.penguinId === penguinId).sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || b.openedAt - a.openedAt);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <p className="eyebrow mb-3">Activity check</p>
        <InsightCard penguinId={penguinId} />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Health follow-ups</p>
          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus size={13} /> Open follow-up
            </Button>
          )}
        </div>
        {adding && <NewCaseForm penguinId={penguinId} onDone={() => setAdding(false)} />}
        {!mine.length && !adding && <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-xs text-muted">No follow-ups. Open one if the team needs to keep an eye on something specific.</p>}
        {mine.map((c) => (
          <CaseCard key={c.id} hc={c} />
        ))}
      </div>
    </div>
  );
}
