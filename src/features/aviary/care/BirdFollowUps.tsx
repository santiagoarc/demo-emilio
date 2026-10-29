"use client";

import { useState, type FormEvent } from "react";
import { CalendarClock, HeartPulse, Plus } from "lucide-react";
import { FOLLOW_KIND_LABEL, PRIORITY_LABEL, type BirdFollowKind, type BirdFollowUp, type FollowPriority } from "@/domain/aviaryCare";
import { MONITOR_TEAM_BY_ID } from "@/data/aviaryTeams";
import { DAY, fmtDateTime } from "@/logic/time";
import { useAviaryCare } from "@/state/useAviaryCare";
import { useTeamAssignments } from "@/state/useTeams";
import { Badge, Button, Select, cx } from "@/components/ui/primitives";
import { CaseCard } from "@/features/health/HealthCards";
import { BirdInsightBlock } from "../monitor/BirdActivity";
import { useAviarySnapshot } from "../common";

export const PRIORITY_TONE: Record<FollowPriority, "danger" | "warn" | "neutral"> = { high: "danger", medium: "warn", low: "neutral" };

export function PriorityBadge({ priority }: { priority: FollowPriority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]} priority</Badge>;
}

/** Whether a follow-up needs attention now: high priority, or its review date has passed. */
export function needsAttention(fu: BirdFollowUp, now: number) {
  return fu.status === "open" && (fu.priority === "high" || (fu.nextReviewAt !== undefined && fu.nextReviewAt <= now));
}

/** The penguin follow-up log, writing to the aviary records at the aviary clock. */
export function BirdCaseLog({ fu, expandedByDefault }: { fu: BirdFollowUp; expandedByDefault?: boolean }) {
  const { ds, asOf } = useAviarySnapshot();
  const { addEntry, closeCase } = useAviaryCare(ds);
  return (
    <CaseCard
      hc={fu}
      expandedByDefault={expandedByDefault}
      reasonLabel={FOLLOW_KIND_LABEL[fu.kind]}
      actions={{ now: asOf, addEntry: (id, text, kg) => addEntry(id, text, asOf, kg), close: (id, text) => closeCase(id, text, asOf) }}
    />
  );
}

/** Same form as the penguin one, with the reasons that apply to birds. */
export function NewBirdFollowUpForm({ birdId, onDone }: { birdId?: string; onDone: (id?: string) => void }) {
  const { ds, registry, asOf } = useAviarySnapshot();
  const { openCase } = useAviaryCare(ds);
  const { teamOf } = useTeamAssignments(registry);
  const [bid, setBid] = useState(birdId ?? "");
  const [kind, setKind] = useState<BirdFollowKind>("activity");
  const [priority, setPriority] = useState<FollowPriority>("medium");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [review, setReview] = useState("2");
  const bird = registry.birds.find((b) => b.id === bid);
  const team = bird ? MONITOR_TEAM_BY_ID[teamOf(bird)] : null;
  const [owner, setOwner] = useState("");
  const field = "w-full rounded-lg border border-line-strong bg-panel-solid px-2.5 text-sm text-ink outline-none focus:border-accent";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!bid || !title.trim()) return;
    const days = Number(review);
    const id = openCase(
      {
        birdId: bid,
        kind,
        priority,
        title: title.trim(),
        owner: owner || team?.lead || "Care team",
        text: text.trim() || "Follow-up opened.",
        nextReviewAt: days > 0 ? asOf + days * DAY : undefined,
      },
      asOf,
    );
    onDone(id);
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-accent/40 bg-accent/[0.04] p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <HeartPulse size={15} className="text-accent" /> New health follow-up
      </p>
      {!birdId && (
        <label className="block text-[11px] text-muted">
          Bird
          <Select value={bid} onChange={(e) => setBid(e.target.value)} className={cx(field, "mt-1 h-9")}>
            <option value="">Choose a bird…</option>
            {registry.birds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id}
                {b.name ? ` · ${b.name}` : ""}
              </option>
            ))}
          </Select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[11px] text-muted">
          Reason
          <Select value={kind} onChange={(e) => setKind(e.target.value as BirdFollowKind)} className={cx(field, "mt-1 h-9")}>
            {(Object.keys(FOLLOW_KIND_LABEL) as BirdFollowKind[]).map((k) => (
              <option key={k} value={k}>
                {FOLLOW_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-[11px] text-muted">
          Owner
          <Select value={owner} onChange={(e) => setOwner(e.target.value)} className={cx(field, "mt-1 h-9")}>
            <option value="">{team ? `${team.lead} (team lead)` : "Care team"}</option>
            {(team?.members ?? []).slice(1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-[11px] text-muted">
          Priority
          <Select value={priority} onChange={(e) => setPriority(e.target.value as FollowPriority)} className={cx(field, "mt-1 h-9")}>
            {(["high", "medium", "low"] as FollowPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-[11px] text-muted">
          Next review
          <Select value={review} onChange={(e) => setReview(e.target.value)} className={cx(field, "mt-1 h-9")}>
            <option value="1">In 1 day</option>
            <option value="2">In 2 days</option>
            <option value="7">In a week</option>
            <option value="0">Not set</option>
          </Select>
        </label>
      </div>
      <label className="block text-[11px] text-muted">
        What is being followed
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fewer flights since Monday" className={cx(field, "mt-1 h-9")} />
      </label>
      <label className="block text-[11px] text-muted">
        First observation
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className={cx(field, "mt-1 resize-none py-2")} />
      </label>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[10px] text-faint">A follow-up flags something to check. It is not a diagnosis.</span>
        <Button type="button" size="sm" variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" size="sm" variant="primary" disabled={!bid || !title.trim()}>
          <Plus size={13} /> Open follow-up
        </Button>
      </div>
    </form>
  );
}

/** Health block of a bird profile: activity check and its follow-ups (as on the penguin profile). */
export function BirdHealth({ birdId }: { birdId: string }) {
  const { ds, asOf, birdById } = useAviarySnapshot();
  const { cases } = useAviaryCare(ds);
  const [adding, setAdding] = useState(false);
  const bird = birdById.get(birdId)!;
  const mine = cases.filter((c) => c.birdId === birdId).sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || b.openedAt - a.openedAt);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <p className="eyebrow mb-3">Activity check</p>
        <BirdInsightBlock bird={bird} asOf={asOf} title={false} />
        <p className="mt-2 text-[11px] leading-snug text-faint">Inference from tracking data — not a clinical assessment.</p>
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
        {adding && <NewBirdFollowUpForm birdId={birdId} onDone={() => setAdding(false)} />}
        {!mine.length && !adding && <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-xs text-muted">No follow-ups. Open one if the team needs to keep an eye on something specific.</p>}
        {mine.map((c) => (
          <div key={c.id} className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <PriorityBadge priority={c.priority} />
              {c.nextReviewAt !== undefined && c.status === "open" && (
                <span className={cx("inline-flex items-center gap-1", c.nextReviewAt <= asOf && "text-danger")}>
                  <CalendarClock size={12} /> Next review {fmtDateTime(c.nextReviewAt, asOf)}
                </span>
              )}
            </div>
            <BirdCaseLog fu={c} />
          </div>
        ))}
      </div>
    </div>
  );
}
