"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, CalendarClock, ChevronRight, HeartPulse, MapPinned, Plus } from "lucide-react";
import { FOLLOW_KIND_LABEL, PRIORITY_LABEL, type BirdFollowUp, type FollowPriority } from "@/domain/aviaryCare";
import { FIX_STATUS, MONITOR_ZONE_BY_ID } from "@/domain/aviaryTracking";
import { MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { SPECIES_INFO } from "@/data/aviarySpeciesInfo";
import { MONITOR_TEAM_BY_ID } from "@/data/aviaryTeams";
import { birdInsight, flightStats, speciesFlightBaseline, type BirdInsight } from "@/logic/aviaryActivity";
import type { InsightLevel } from "@/logic/insights";
import { DAY, fmtAgo, fmtDateTime } from "@/logic/time";
import { useAviaryCare } from "@/state/useAviaryCare";
import { useTeamAssignments } from "@/state/useTeams";
import { Badge, Button, Card, Drawer, Segmented, Select, cx } from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/AppShell";
import { InsightBadge } from "@/features/health/HealthCards";
import { BirdActivity } from "../monitor/BirdActivity";
import { SpeciesAvatar } from "../SpeciesAvatar";
import { useAviarySnapshot } from "../common";
import { BirdCaseLog, NewBirdFollowUpForm, PriorityBadge, needsAttention } from "./BirdFollowUps";

const PRIORITY_RANK: Record<FollowPriority, number> = { high: 0, medium: 1, low: 2 };
const LEVEL_RANK: Record<InsightLevel, number> = { check: 0, watch: 1, ok: 2 };
const fmtMin = (m: number) => (m >= 90 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);

/**
 * Health follow-up of the aviary: the penguin Health screen for birds. Follow-ups the team
 * is tracking, plus an activity check of every bird against its species and its own days.
 */
export function AviaryHealthView() {
  const { ds, registry, asOf } = useAviarySnapshot();
  const { cases } = useAviaryCare(ds);
  const { teamOf } = useTeamAssignments(registry);
  const [adding, setAdding] = useState(false);
  const [show, setShow] = useState<"attention" | "all">("attention");
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = cases.find((c) => c.id === openId) ?? null;

  const lastUpdate = (c: BirdFollowUp) => c.entries[0]?.at ?? c.openedAt;
  const open = cases
    .filter((c) => c.status === "open")
    .sort((a, b) => Number(needsAttention(b, asOf)) - Number(needsAttention(a, asOf)) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || lastUpdate(b) - lastUpdate(a));
  const closed = cases.filter((c) => c.status === "closed").sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  const attention = open.filter((c) => needsAttention(c, asOf)).length;

  // Activity check of every bird: computed once per saved clock time.
  const insights = useMemo(() => {
    const base = new Map(registry.species.map((s) => [s.id, speciesFlightBaseline(ds, s.id, asOf)]));
    return new Map(registry.birds.map((b) => [b.id, birdInsight(ds, b, asOf, base.get(b.speciesId) ?? null)]));
  }, [ds, registry, asOf]);
  const count = (l: InsightLevel) => [...insights.values()].filter((i) => i.level === l).length;
  const inCase = new Map(open.map((c) => [c.birdId, c.id]));
  const rows = useMemo(
    () =>
      registry.birds
        .map((b) => ({ b, ins: insights.get(b.id)! }))
        .filter((r) => show === "all" || r.ins.level !== "ok")
        .sort((a, b) => LEVEL_RANK[a.ins.level] - LEVEL_RANK[b.ins.level] || ratio(a.ins) - ratio(b.ins)),
    [registry, insights, show],
  );

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Aviary · Health"
        title="Follow-ups & activity checks"
        subtitle={<>Follow-ups the team is tracking, and each bird&rsquo;s last 24 h of flight compared with its species and its own days. Activity checks are inferences from tracking data — not a clinical assessment.</>}
        actions={
          !adding && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus size={15} /> New follow-up
            </Button>
          )
        }
      />

      <div className="space-y-5 px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Open follow-ups" value={open.length} sub={`${attention} need attention · ${closed.length} closed`} color="var(--accent)" />
          <Stat label="Review" value={count("check")} sub="flight well outside the usual" color="var(--danger)" />
          <Stat label="Watch" value={count("watch")} sub="flight changed" color="var(--warn)" />
          <Stat label="Typical" value={count("ok")} sub={`of ${registry.birds.length} birds`} color="var(--ok)" />
        </div>

        {adding && (
          <NewBirdFollowUpForm
            onDone={(id) => {
              setAdding(false);
              if (id) setOpenId(id);
            }}
          />
        )}

        <Card title="Open follow-ups" icon={HeartPulse} subtitle="Needing attention first, then by priority and last update · click one to see it">
          {!open.length && <p className="py-6 text-center text-sm text-muted">No open follow-ups.</p>}
          <ul className="space-y-1">
            {open.map((c) => (
              <li key={c.id}>
                <FollowUpRow fu={c} asOf={asOf} team={MONITOR_TEAM_BY_ID[teamOf(registry.birds.find((b) => b.id === c.birdId)!)].name} onOpen={() => setOpenId(c.id)} />
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Activity checks"
          subtitle="Last 24 h vs. the species average and the bird's own previous days · inferred from tracking data, not a clinical assessment"
          action={<Segmented size="sm" value={show} onChange={setShow} options={[{ value: "attention", label: "Review & watch" }, { value: "all", label: "All" }]} />}
        >
          <div className="scroll-thin max-h-[560px] overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-panel-solid">
                <tr className="border-b border-line text-left text-[11px] text-muted">
                  <th className="px-3 py-2 font-medium">Bird</th>
                  <th className="px-3 py-2 font-medium">Activity</th>
                  <th className="px-3 py-2 font-medium">Flying, 24 h (species avg.)</th>
                  <th className="px-3 py-2 font-medium">Why</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ b, ins }) => {
                  const sp = MONITOR_SPECIES_BY_ID[b.speciesId];
                  return (
                    <tr key={b.id} className="border-b border-line/60 align-top hover:bg-ink/[0.02]">
                      <td className="px-3 py-2.5">
                        <Link href={`/aviary/birds/${b.id}`} className="flex items-center gap-2 hover:underline">
                          <SpeciesAvatar code={sp.code} size={22} ring={sp.color} />
                          <span className="font-mono text-xs">{b.id}</span>
                        </Link>
                        <p className="ml-[30px] text-[11px] text-faint">{MONITOR_TEAM_BY_ID[teamOf(b)].name}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <InsightBadge level={ins.level} />
                      </td>
                      <td className="num px-3 py-2.5 text-xs">
                        {b.device.status === "intermittent" ? (
                          <span className="text-faint">Not available</span>
                        ) : (
                          <>
                            {fmtMin(ins.today.flyingMin)} <span className="text-faint">({ins.species ? fmtMin(ins.species.flyingMin) : "—"})</span>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted">{ins.points.map((x) => x.text).join(" ")}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        {inCase.has(b.id) ? (
                          <button onClick={() => setOpenId(inCase.get(b.id)!)} className="text-[11px] font-medium text-accent hover:underline">
                            View follow-up
                          </button>
                        ) : (
                          <Link href={`/aviary/birds/${b.id}#health`} className="text-[11px] text-accent hover:underline">
                            View profile
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && <p className="py-6 text-center text-sm text-muted">Every bird&rsquo;s flight is within the usual range.</p>}
          </div>
        </Card>

        {closed.length > 0 && (
          <Card title="Closed" subtitle="Follow-ups that have been resolved">
            <ul className="space-y-1">
              {closed.map((c) => (
                <li key={c.id}>
                  <FollowUpRow fu={c} asOf={asOf} onOpen={() => setOpenId(c.id)} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Drawer open={!!selected} onClose={() => setOpenId(null)} width={560} title="Health follow-up">
        {selected && <FollowUpDetail fu={selected} />}
      </Drawer>
    </div>
  );
}

/** Flight against the species: lower first, for sorting within a level. */
function ratio(ins: BirdInsight) {
  return ins.species && ins.species.flyingMin > 0 ? ins.today.flyingMin / ins.species.flyingMin : 1;
}

/** One follow-up in a compact row, like a species row. */
function FollowUpRow({ fu, asOf, team, onOpen }: { fu: BirdFollowUp; asOf: number; team?: string; onOpen: () => void }) {
  const { birdById } = useAviarySnapshot();
  const bird = birdById.get(fu.birdId);
  if (!bird) return null;
  const sp = MONITOR_SPECIES_BY_ID[bird.speciesId];
  const open = fu.status === "open";
  const attention = needsAttention(fu, asOf);
  const updated = fu.entries[0]?.at ?? fu.openedAt;
  return (
    <button
      onClick={onOpen}
      className={cx(
        "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-ink/[0.045] hover:shadow-[0_2px_8px_rgba(11,36,64,0.08)]",
        attention && "bg-danger/[0.04]",
      )}
    >
      <span className={cx("h-8 w-1 shrink-0 rounded-full", fu.priority === "high" ? "bg-danger" : fu.priority === "medium" ? "bg-warn" : "bg-line-strong")} title={`${PRIORITY_LABEL[fu.priority]} priority`} />
      <SpeciesAvatar code={sp.code} size={34} ring={sp.color} />
      <span className="w-[86px] shrink-0">
        <span className="block font-mono text-xs font-semibold text-ink">{bird.id}</span>
        <span className="block truncate text-[10.5px] text-muted">{sp.common}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{fu.title}</span>
        <span className="block truncate text-[11px] text-muted">
          {FOLLOW_KIND_LABEL[fu.kind]}
          {team ? ` · ${team}` : ""}
        </span>
      </span>
      {attention && (
        <span className="hidden items-center gap-1 text-[11px] font-medium text-danger sm:inline-flex">
          <AlertTriangle size={12} /> Needs attention
        </span>
      )}
      <Badge tone={open ? "accent" : "neutral"}>{open ? "Open" : "Closed"}</Badge>
      <span className="hidden w-[118px] shrink-0 text-right text-[11px] text-muted md:block" title={fmtDateTime(updated, asOf)}>
        Updated {fmtAgo(updated, asOf)}
      </span>
      <ChevronRight size={15} className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
    </button>
  );
}

/** The follow-up popup: the bird, why it is followed, its activity and the log. */
function FollowUpDetail({ fu }: { fu: BirdFollowUp }) {
  const { ds, registry, asOf, birdById, fixes } = useAviarySnapshot();
  const { notes, updateCase } = useAviaryCare(ds);
  const { teamOf } = useTeamAssignments(registry);
  const [win, setWin] = useState<"24h" | "7d">("24h");
  const bird = birdById.get(fu.birdId)!;
  const sp = MONITOR_SPECIES_BY_ID[bird.speciesId];
  const team = MONITOR_TEAM_BY_ID[teamOf(bird)];
  const fix = fixes.get(bird.id)!;
  // Trees and zones of the last week, and the trees it went back to most.
  const { week, visited } = useMemo(() => {
    const b = birdById.get(fu.birdId)!;
    const stays = ds.stays.get(fu.birdId) ?? [];
    const m = new Map<string, number>();
    for (const s of stays) if (s.start >= asOf - 7 * DAY && s.start <= asOf) m.set(s.treeId, (m.get(s.treeId) ?? 0) + 1);
    return {
      week: flightStats(b, stays, Math.max(ds.windowStart, asOf - 7 * DAY), asOf),
      visited: [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6),
    };
  }, [birdById, fu.birdId, ds, asOf]);
  const myNotes = notes.filter((n) => n.birdId === bird.id).slice(0, 4);
  const open = fu.status === "open";
  const attention = needsAttention(fu, asOf);
  const days = Math.max(1, Math.round(((fu.closedAt ?? asOf) - fu.openedAt) / DAY));
  const zoneOnly = bird.device.status === "intermittent";
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-line/60 py-2 text-xs last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right text-ink">{v}</span>
    </div>
  );

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SPECIES_INFO[sp.code].photo.src} alt={sp.common} className="h-20 w-20 rounded-2xl object-cover" />
        <div className="min-w-0">
          <p className="font-mono text-lg font-semibold">{bird.id}</p>
          {bird.name && <p className="text-sm text-ink">{bird.name}</p>}
          <p className="text-xs text-muted">
            {sp.common} · <span className="italic">{sp.scientific}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone={open ? "accent" : "neutral"}>{open ? "Open" : "Closed"}</Badge>
            <PriorityBadge priority={fu.priority} />
          </div>
        </div>
      </div>

      {attention && (
        <p className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/[0.06] px-3 py-2 text-xs text-ink">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" />
          {fu.priority === "high" ? "High priority: check this bird on the next round." : "The planned review date has passed."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/aviary/birds/${bird.id}#health`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-xs text-ink hover:border-accent/50">
          View profile <ArrowUpRight size={12} />
        </Link>
        <Link href={`/aviary/map?bird=${bird.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-xs text-ink hover:border-accent/50">
          <MapPinned size={13} /> View on map
        </Link>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink">{fu.title}</p>
        <p className="text-[11px] text-muted">{FOLLOW_KIND_LABEL[fu.kind]}</p>
      </div>

      <div className="rounded-xl border border-line px-3">
        {row("Followed by", (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: team.color }} />
            {team.name}
          </span>
        ))}
        {row("Owner", fu.owner)}
        {row(open ? "Opened" : "Duration", open ? `${fmtDateTime(fu.openedAt, asOf)} · ${days} ${days === 1 ? "day" : "days"} ago` : `${days} ${days === 1 ? "day" : "days"}`)}
        {row("Last location", fix.det?.zoneId ? `${MONITOR_ZONE_BY_ID[fix.det.zoneId].name}${fix.det.treeId ? ` · ${fix.det.treeId}` : ""} · ${fmtAgo(fix.det.at, asOf)}` : "No location")}
        {row("Detection status", FIX_STATUS[fix.status].label)}
        {row("Next review", fu.nextReviewAt !== undefined ? <span className={cx(fu.nextReviewAt <= asOf && open && "text-danger")}>{fmtDateTime(fu.nextReviewAt, asOf)}</span> : "Not scheduled")}
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[11px] text-muted">
            Priority
            <Select value={fu.priority} onChange={(e) => updateCase(fu.id, { priority: e.target.value as FollowPriority })} className="mt-1 h-8 w-full">
              {(["high", "medium", "low"] as FollowPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={11} /> Set next review
            </span>
            <Select value="" onChange={(e) => e.target.value && updateCase(fu.id, { nextReviewAt: e.target.value === "none" ? undefined : asOf + Number(e.target.value) * DAY })} className="mt-1 h-8 w-full">
              <option value="">Choose…</option>
              <option value="1">In 1 day</option>
              <option value="2">In 2 days</option>
              <option value="7">In a week</option>
              <option value="none">Clear</option>
            </Select>
          </label>
        </div>
      )}

      <div>
        <p className="eyebrow mb-1">Recent activity</p>
        {zoneOnly ? (
          <p className="rounded-lg bg-warn/[0.08] px-2.5 py-2 text-[11px] text-ink">Zone-only tag: no positions, so no flight or distance figures.</p>
        ) : (
          <BirdActivity
            bird={bird}
            asOf={asOf}
            windowMs={win === "7d" ? 7 * DAY : DAY}
            windowLabel={win === "7d" ? "last 7 days" : "last 24 h"}
            control={<Segmented size="sm" value={win} onChange={setWin} options={[{ value: "24h", label: "24 h" }, { value: "7d", label: "7 days" }]} />}
          />
        )}
      </div>

      {!zoneOnly && (
        <div>
          <p className="eyebrow mb-1.5">Trees and zones visited · last 7 days</p>
          <p className="text-xs text-muted">
            {week.treesVisited} trees in {week.zonesVisited} zones. Most visited:{" "}
            {visited.map(([t, n]) => `${t} (${n})`).join(", ") || "—"}
          </p>
        </div>
      )}

      <div>
        <p className="eyebrow mb-1.5">Team observations</p>
        {myNotes.length === 0 ? (
          <p className="text-xs text-muted">No observations for this bird.</p>
        ) : (
          <ul className="space-y-2">
            {myNotes.map((n) => (
              <li key={n.id} className="border-l-2 border-line-strong pl-3 text-xs">
                <p className="text-ink">{n.text}</p>
                <p className="text-[11px] text-faint">
                  {n.by} · {fmtDateTime(n.at, asOf)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="eyebrow mb-2">Follow-up log</p>
        <BirdCaseLog fu={fu} expandedByDefault />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="panel p-4">
      <p className="flex items-center gap-2 text-xs text-muted">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </p>
      <p className="num mt-1 text-2xl font-semibold text-ink">{value}</p>
      <p className="text-[11px] text-faint">{sub}</p>
    </div>
  );
}
