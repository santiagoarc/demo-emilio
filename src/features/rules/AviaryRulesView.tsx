"use client";

import { useMemo } from "react";
import { MONITOR_ZONE_BY_ID } from "@/domain/aviaryTracking";
import { MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { treeOccupants } from "@/logic/aviaryTracking";
import { HOUR, fmtAgo } from "@/logic/time";
import { PageHeader } from "@/components/shell/AppShell";
import { AviaryFrame, useAviarySnapshot } from "@/features/aviary/common";
import { ProposedRules, type RuleDef, type RuleIdea } from "./ProposedRules";

const IDEAS: RuleIdea[] = [
  { name: "Feeding intake below usual", needs: "Needs per-bird or per-group feeding records that the keepers validate. Not part of the demo data." },
  { name: "Weight trend", needs: "Needs a regular, validated weighing routine with the bird's identity confirmed at each weigh-in." },
  { name: "Breeding / nesting events", needs: "Needs nest-box checks or breeding records agreed with the avian team. Nothing like that is simulated here." },
];

export function AviaryRulesView() {
  const { registry, ds, src, fixes, asOf } = useAviarySnapshot();
  const label = (id: string) => `${id} · ${MONITOR_SPECIES_BY_ID[registry.birds.find((b) => b.id === id)!.speciesId].common}`;

  const rules = useMemo<RuleDef[]>(
    () => [
      {
        id: "no-signal",
        name: "No recent detection",
        description: (n) => `Flags a bird with no detection in the last ${n} hours, so a keeper can look for it and check its device.`,
        scope: "All demo birds",
        basis: "Simulated detections · time of the last one",
        threshold: { label: "No detection for at least", unit: "hours", default: 6, min: 1, max: 48, step: 1 },
        defaultEnabled: true,
        noun: ["bird", "birds"],
        evaluate: (n) =>
          [...fixes.values()]
            .filter((f) => !f.det || asOf - f.det.at >= n * HOUR)
            .map((f) => ({ key: f.bird.id, label: label(f.bird.id), detail: f.det ? `last ${fmtAgo(f.det.at, asOf)}` : "never detected", href: `/aviary/map?bird=${f.bird.id}` })),
      },
      {
        id: "low-battery",
        name: "Device battery low",
        description: (n) => `Flags a device whose battery is at or below ${n}%, to plan its replacement.`,
        scope: "All demo devices",
        basis: "Simulated device status",
        threshold: { label: "Battery at or below", unit: "%", default: 20, min: 5, max: 50, step: 5 },
        defaultEnabled: true,
        noun: ["device", "devices"],
        evaluate: (n) =>
          registry.birds
            .filter((b) => b.device.batteryPct <= n)
            .sort((a, b) => a.device.batteryPct - b.device.batteryPct)
            .map((b) => ({ key: b.id, label: label(b.id), detail: `${b.device.id} · ${b.device.batteryPct}%`, href: `/aviary/map?bird=${b.id}` })),
      },
      {
        id: "away-from-home",
        name: "Bird away from its usual zone",
        description: (n) => `Flags a bird that has spent the last ${n} hours outside its usual zone.`,
        scope: "Birds with a detection in the period",
        basis: "Simulated location history",
        threshold: { label: "Outside its zone for at least", unit: "hours", default: 4, min: 1, max: 24, step: 1 },
        defaultEnabled: false,
        noun: ["bird", "birds"],
        evaluate: (n) =>
          registry.birds
            .filter((b) => {
              const h = src.history(b.id, asOf - n * HOUR, asOf);
              return h.length > 0 && h.every((s) => s.zoneId !== b.homeZoneId);
            })
            .map((b) => ({ key: b.id, label: label(b.id), detail: `usual zone ${MONITOR_ZONE_BY_ID[b.homeZoneId].name}`, href: `/aviary/map?bird=${b.id}` })),
      },
      {
        id: "crowded-tree",
        name: "Many birds in one tree",
        description: (n) => `Flags a tree with ${n} or more birds located in it at the same time.`,
        scope: "All demo trees",
        basis: "Latest simulated detections",
        threshold: { label: "At least", unit: "birds", default: 12, min: 3, max: 40, step: 1 },
        defaultEnabled: false,
        noun: ["tree", "trees"],
        evaluate: (n) =>
          registry.trees
            .map((t) => ({ t, n: treeOccupants(fixes, t.id).length }))
            .filter((x) => x.n >= n)
            .sort((a, b) => b.n - a.n)
            .map(({ t, n: c }) => ({ key: t.id, label: `${t.id} · ${MONITOR_ZONE_BY_ID[t.zoneId].name}`, detail: `${c} birds` })),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registry, ds, src, fixes, asOf],
  );

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Aviary · Proposed rules"
        title="Proposed rules"
        subtitle="Examples of checks the aviary team could switch on once real data exists. Adjust a threshold to see how many demo birds it would touch."
      />
      <AviaryFrame banner="Match counts below are computed on the demo registry at the saved simulated clock time.">
        <ProposedRules
          storageKey="penguin-demo/rules/aviary-v2"
          rules={rules}
          ideas={IDEAS}
          intro="None of these rules is running. They send no notifications and do not replace keeper judgement; they exist to agree with SeaWorld which checks are useful and at what thresholds."
        />
      </AviaryFrame>
    </div>
  );
}
