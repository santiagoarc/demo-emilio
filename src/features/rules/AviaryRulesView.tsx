"use client";

import { useMemo } from "react";
import { AVIARY_SPECIES_BY_ID, AVIARY_ZONE_BY_ID } from "@/domain/aviary";
import { AVIARY_HISTORY_DAYS } from "@/data/aviarySimulate";
import { daysAgoLabel, headcountAgeBySpecies, notObservedFor, offExhibitDays, zoneLogbookActivity } from "@/logic/aviary";
import { useAviary } from "@/state/useAviary";
import { PageHeader } from "@/components/shell/AppShell";
import { AviaryFrame } from "@/features/aviary/common";
import { ProposedRules, type RuleDef, type RuleIdea } from "./ProposedRules";

const IDEAS: RuleIdea[] = [
  { name: "Feeding intake below usual", needs: "Needs per-bird or per-group feeding records that the keepers validate. Not part of the demo data." },
  { name: "Weight trend", needs: "Needs a regular, validated weighing routine with the bird's identity confirmed at each weigh-in." },
  { name: "Breeding / nesting events", needs: "Needs nest-box checks or breeding records agreed with the avian team. Nothing like that is simulated here." },
];

export function AviaryRulesView() {
  const { ds } = useAviary();

  const rules = useMemo<RuleDef[]>(
    () => [
      {
        id: "not-observed",
        name: "Bird not observed recently",
        description: (n) => `Flags a bird with no logbook sighting in the last ${n} days, so a keeper can look for it on the next round.`,
        scope: "All birds in the roster",
        basis: "Keeper logbook · last sighting per bird",
        threshold: { label: "Not observed for at least", unit: "days", default: 3, min: 1, max: AVIARY_HISTORY_DAYS, step: 1 },
        defaultEnabled: true,
        noun: ["bird", "birds"],
        evaluate: (n) =>
          notObservedFor(ds, ds.birds, n).map(({ bird, last, days }) => ({
            key: bird.id,
            label: `${bird.id} · ${AVIARY_SPECIES_BY_ID[bird.speciesId].name}`,
            detail: `${daysAgoLabel(days, AVIARY_HISTORY_DAYS)}${last ? ` · ${AVIARY_ZONE_BY_ID[last.zoneId].name}` : ""}`,
            href: `/aviary/birds/${bird.id}`,
          })),
      },
      {
        id: "off-exhibit",
        name: "Bird kept off exhibit",
        description: (n) => `Flags a bird whose sightings have been only in holding or the care room for ${n} days or more, as a prompt to review its plan.`,
        scope: "Off-exhibit Holding and Avian Care Room",
        basis: "Keeper logbook · zone of consecutive sightings",
        threshold: { label: "Off exhibit for at least", unit: "days", default: 2, min: 1, max: AVIARY_HISTORY_DAYS, step: 1 },
        defaultEnabled: true,
        noun: ["bird", "birds"],
        evaluate: (n) =>
          ds.birds
            .map((b) => ({ b, off: offExhibitDays(ds, b.id) }))
            .filter((x) => x.off && x.off.days >= n)
            .sort((a, b) => b.off!.days - a.off!.days)
            .map(({ b, off }) => ({
              key: b.id,
              label: `${b.id} · ${AVIARY_SPECIES_BY_ID[b.speciesId].name}`,
              detail: `${AVIARY_ZONE_BY_ID[off!.zoneId].name} · ${off!.days} days`,
              href: `/aviary/birds/${b.id}`,
            })),
      },
      {
        id: "zone-logbook-gap",
        name: "Zone with fewer sightings than usual",
        description: (n) => `Flags a zone whose logbook entries in the last 24 h fell below ${n}% of its usual daily count — a gap in the logbook, not in the birds.`,
        scope: "All aviary zones (illustrative layout)",
        basis: "Keeper logbook · entries per zone",
        threshold: { label: "Below", unit: "% of usual", default: 50, min: 10, max: 100, step: 5 },
        defaultEnabled: false,
        noun: ["zone", "zones"],
        evaluate: (n) =>
          zoneLogbookActivity(ds)
            .filter((z) => z.usualPerDay >= 1 && z.last24h < (z.usualPerDay * n) / 100)
            .map((z) => ({
              key: z.zone.id,
              label: z.zone.name,
              detail: `${z.last24h} in 24 h · usual ${z.usualPerDay.toFixed(0)}/day`,
              href: `/aviary/habitat?zone=${z.zone.id}`,
            })),
      },
      {
        id: "no-headcount",
        name: "Species group without a headcount",
        description: (n) => `Flags a species group with no headcount entry in the logbook for ${n} days or more.`,
        scope: "All four species groups",
        basis: "Keeper logbook · headcount entries",
        threshold: { label: "No headcount for at least", unit: "days", default: 7, min: 1, max: AVIARY_HISTORY_DAYS, step: 1 },
        defaultEnabled: false,
        noun: ["species group", "species groups"],
        evaluate: (n) =>
          headcountAgeBySpecies(ds)
            .filter((s) => s.days === null || s.days >= n)
            .map((s) => ({ key: s.species.id, label: s.species.name, detail: s.days === null ? `none in ${AVIARY_HISTORY_DAYS} days` : `last ${s.days} days ago` })),
      },
    ],
    [ds],
  );

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Aviary · Proposed rules"
        title="Proposed rules"
        subtitle="Examples of checks the aviary team could switch on once real data exists. Adjust a threshold to see how many demo birds it would touch."
      />
      <AviaryFrame banner="Match counts below are computed on the simulated roster and logbook.">
        <ProposedRules
          storageKey="penguin-demo/rules/aviary"
          rules={rules}
          ideas={IDEAS}
          intro="None of these rules is running. They send no notifications and do not replace keeper judgement; they exist to agree with SeaWorld which checks are useful and at what thresholds."
        />
      </AviaryFrame>
    </div>
  );
}
