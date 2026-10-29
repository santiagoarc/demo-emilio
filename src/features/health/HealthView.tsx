"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HeartPulse, Plus } from "lucide-react";
import { SPECIES_BY_ID } from "@/domain/species";
import type { InsightLevel } from "@/logic/insights";
import { useDemo } from "@/state/DemoProvider";
import { Button, Card, Segmented } from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/AppShell";
import { InsightBadge, NewCaseForm } from "./HealthCards";
import { CaseDrawer, CaseSummary } from "./CaseSummary";

/**
 * Health: cases the team is following closely, plus an activity check for each
 * penguin, to see at a glance who may be worth a look.
 */
export function HealthView() {
  const { dataset, cases, insights, teamOf } = useDemo();
  const [adding, setAdding] = useState(false);
  const [show, setShow] = useState<"attention" | "all">("attention");
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = cases.find((c) => c.id === openId) ?? null;

  const open = cases.filter((c) => c.status === "open").sort((a, b) => (b.entries[0]?.at ?? b.openedAt) - (a.entries[0]?.at ?? a.openedAt));
  const closed = cases.filter((c) => c.status === "closed").sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  const inCase = useMemo(() => new Set(open.map((c) => c.penguinId)), [open]);

  const rank: Record<InsightLevel, number> = { check: 0, watch: 1, ok: 2 };
  const rows = useMemo(
    () =>
      dataset.penguins
        .map((p) => ({ p, ins: insights.get(p.id)! }))
        .filter((r) => r.ins && (show === "all" || r.ins.level !== "ok"))
        .sort((a, b) => rank[a.ins.level] - rank[b.ins.level] || a.ins.water.mine / Math.max(0.1, a.ins.water.species) - b.ins.water.mine / Math.max(0.1, b.ins.water.species)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataset, insights, show],
  );
  const count = (l: InsightLevel) => [...insights.values()].filter((i) => i.level === l).length;
  const teamName = (id: string) => dataset.teams.find((t) => t.id === teamOf(id))?.name ?? "—";


  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Health"
        title="Follow-ups & activity checks"
        subtitle={<>Care follow-ups the team is tracking, and each penguin&rsquo;s last 24 h of activity compared with its species. Activity checks are inferences from location data — not a clinical assessment.</>}
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
          <Stat label="Open follow-ups" value={open.length} sub={`${closed.length} closed`} color="var(--accent)" />
          <Stat label="Review" value={count("check")} sub="activity well outside the usual" color="var(--danger)" />
          <Stat label="Watch" value={count("watch")} sub="activity changed" color="var(--warn)" />
          <Stat label="Typical" value={count("ok")} sub={`of ${dataset.penguins.length} penguins`} color="var(--ok)" />
        </div>

        {adding && (
          <NewCaseForm
            onDone={(id) => {
              setAdding(false);
              if (id) setOpenId(id);
            }}
          />
        )}

        <Card title="Open follow-ups" icon={HeartPulse} subtitle="Care logs, most recently updated first · click one to see its log">
          {!open.length && <p className="py-6 text-center text-sm text-muted">No open follow-ups.</p>}
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {open.map((c) => (
              <CaseSummary key={c.id} hc={c} onOpen={() => setOpenId(c.id)} />
            ))}
          </div>
        </Card>

        <Card
          title="Activity checks"
          subtitle="Last 24 h vs. the species average and the penguin's own previous days · inferred from location data, not a clinical assessment"
          action={
            <Segmented
              size="sm"
              value={show}
              onChange={setShow}
              options={[
                { value: "attention", label: "Review & watch" },
                { value: "all", label: "All" },
              ]}
            />
          }
        >
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted">
                  <th className="px-3 py-2 font-medium">Penguin</th>
                  <th className="px-3 py-2 font-medium">Activity</th>
                  <th className="px-3 py-2 font-medium">Water, 24 h (species avg.)</th>
                  <th className="px-3 py-2 font-medium">Why</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, ins }) => (
                  <tr key={p.id} className="border-b border-line/60 align-top hover:bg-ink/[0.02]">
                    <td className="px-3 py-2.5">
                      <Link href={`/penguins/${p.id}`} className="flex items-center gap-2 hover:underline">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: SPECIES_BY_ID[p.speciesId].color }} />
                        <span className="font-mono text-xs">{p.id}</span>
                        {p.name && <span className="text-xs text-muted">{p.name}</span>}
                      </Link>
                      <p className="ml-[18px] text-[11px] text-faint">{teamName(p.id)}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <InsightBadge level={ins.level} />
                    </td>
                    <td className="num px-3 py-2.5 text-xs">
                      {ins.water.mine.toFixed(1)} h <span className="text-faint">({ins.water.species.toFixed(1)} h)</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">{ins.points.map((x) => x.text).join(" ")}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      {inCase.has(p.id) ? (
                        <button onClick={() => setOpenId(open.find((c) => c.penguinId === p.id)!.id)} className="text-[11px] font-medium text-accent hover:underline">
                          View follow-up
                        </button>
                      ) : (
                        <Link href={`/penguins/${p.id}#health`} className="text-[11px] text-accent hover:underline">
                          View profile
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="py-6 text-center text-sm text-muted">Every penguin&rsquo;s activity is within the usual range.</p>}
          </div>
        </Card>

        {closed.length > 0 && (
          <Card title="Closed" subtitle="Follow-ups that have been resolved">
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {closed.map((c) => (
                <CaseSummary key={c.id} hc={c} onOpen={() => setOpenId(c.id)} />
              ))}
            </div>
          </Card>
        )}
      </div>

      <CaseDrawer hc={selected} onClose={() => setOpenId(null)} />
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
