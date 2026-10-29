"use client";

import { useMemo } from "react";
import { ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES_BY_ID } from "@/domain/species";
import type { Dataset } from "@/domain/types";
import { HOUR } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { PageHeader } from "@/components/shell/AppShell";
import { ProposedRules, type RuleDef, type RuleIdea } from "./ProposedRules";

const IDEAS: RuleIdea[] = [
  { name: "Feeding intake below usual", needs: "Needs per-penguin feeding records validated by the keepers. No feeding data yet." },
  { name: "Weight trend", needs: "Needs a validated weighing routine linked to each penguin's identity. Not recorded yet." },
  { name: "Breeding / nesting events", needs: "Needs nest checks or breeding records agreed with the animal-care team. Not recorded yet." },
];

/** Hours a penguin's latest readings have stayed at exactly the same position. */
function stationaryHours(ds: Dataset, penguinId: string): number {
  const list = ds.readings.get(penguinId) ?? [];
  if (list.length < 2) return 0;
  const last = list[list.length - 1];
  let i = list.length - 1;
  while (i > 0 && list[i - 1].x === last.x && list[i - 1].y === last.y) i--;
  return (last.timestamp - list[i].timestamp) / HOUR;
}

export function PenguinRulesView() {
  const { dataset, snapshots, insights } = useDemo();

  const rules = useMemo<RuleDef[]>(() => {
    const label = (id: string) => {
      const p = dataset.penguins.find((x) => x.id === id);
      const sp = p ? SPECIES_BY_ID[p.speciesId] : undefined;
      return `${id}${p?.name ? ` · ${p.name}` : ""}${sp ? ` · ${sp.nameEn}` : ""}`;
    };
    return [
      {
        id: "low-water-time",
        name: "Low time in water",
        description: (n) => `Flags a penguin whose time in water over the last 24 h is below ${n}% of its species' daily average. Only counted when the day has enough readings to compare.`,
        scope: "All penguins · last 24 h",
        basis: "Location readings · water / land",
        threshold: { label: "Below", unit: "% of species average", default: 40, min: 5, max: 100, step: 5 },
        defaultEnabled: true,
        noun: ["penguin", "penguins"],
        evaluate: (n) =>
          dataset.penguins
            .map((p) => ({ p, ins: insights.get(p.id) }))
            .filter(({ ins }) => ins && ins.coverage >= 0.6 && ins.water.species > 0 && (ins.water.mine / ins.water.species) * 100 < n)
            .sort((a, b) => a.ins!.water.mine / a.ins!.water.species - b.ins!.water.mine / b.ins!.water.species)
            .map(({ p, ins }) => ({
              key: p.id,
              label: label(p.id),
              detail: `${ins!.water.mine.toFixed(1)} h vs ${ins!.water.species.toFixed(1)} h avg`,
              href: `/penguins/${p.id}`,
            })),
      },
      {
        id: "stationary",
        name: "Stationary for a long stretch",
        description: (n) => `Flags a penguin whose most recent readings have stayed at the same position for ${n} h or more, so a keeper can take a look.`,
        scope: "All penguins · latest readings",
        basis: "Location readings · position",
        threshold: { label: "Same position for at least", unit: "hours", default: 4, min: 1, max: 24, step: 1 },
        defaultEnabled: true,
        noun: ["penguin", "penguins"],
        evaluate: (n) =>
          dataset.penguins
            .map((p) => ({ p, h: stationaryHours(dataset, p.id) }))
            .filter((x) => x.h >= n)
            .sort((a, b) => b.h - a.h)
            .map(({ p, h }) => {
              const z = snapshots.get(p.id)?.reading?.zoneId;
              return { key: p.id, label: label(p.id), detail: `${h.toFixed(1)} h${z ? ` · ${ZONE_BY_ID[z]?.name ?? z}` : ""}`, href: `/penguins/${p.id}` };
            }),
      },
      {
        id: "no-reading",
        name: "No recent location reading",
        description: (n) => `Flags a penguin whose last location reading is ${n} h old or more, as a prompt to confirm it visually on the next round.`,
        scope: "All penguins",
        basis: "Location readings · time of the last reading",
        threshold: { label: "Last reading at least", unit: "hours old", default: 6, min: 1, max: 72, step: 1 },
        defaultEnabled: false,
        noun: ["penguin", "penguins"],
        evaluate: (n) =>
          dataset.penguins
            .map((p) => ({ p, s: snapshots.get(p.id) }))
            .filter(({ s }) => s && s.ageMin / 60 >= n)
            .sort((a, b) => b.s!.ageMin - a.s!.ageMin)
            .map(({ p, s }) => ({
              key: p.id,
              label: label(p.id),
              detail: Number.isFinite(s!.ageMin) ? `${(s!.ageMin / 60).toFixed(1)} h ago` : "no reading in the window",
              href: `/penguins/${p.id}`,
            })),
      },
    ];
  }, [dataset, snapshots, insights]);

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Penguins · Proposed rules"
        title="Proposed rules"
        subtitle="Examples of checks the penguin team could switch on later. Adjust a threshold to see how many penguins it would touch."
      />
      <div className="px-6 lg:px-8">
        <ProposedRules
          storageKey="penguin-demo/rules/penguins"
          rules={rules}
          ideas={IDEAS}
          backHref="/penguins"
          backLabel="Back to penguins"
          intro="None of these rules is running. They send no notifications and do not replace keeper judgement. Matches are computed on the penguin data."
        />
      </div>
    </div>
  );
}
