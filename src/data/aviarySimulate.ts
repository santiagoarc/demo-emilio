import {
  AVIARY_ESTIMATE,
  AVIARY_SPECIES,
  AVIARY_TEAMS,
  type AviaryDataset,
  type AviarySpeciesId,
  type Bird,
  type BirdObservation,
  type ObservationKind,
} from "@/domain/aviary";
import { between, chance, hashSeed, mulberry32, pick, type Rng } from "@/logic/rng";
import { DAY, HOUR, MIN, startOfDay } from "@/logic/time";

/**
 * Simulated aviary roster and keeper sightings.
 *
 * The 500 records only stand in for the meeting's estimate. Species split,
 * names, bands and every sighting are fictional. Sightings are what a keeper
 * would log by hand (zone level), so the demo never implies tracking devices.
 */

export const AVIARY_HISTORY_DAYS = 14;

/** Demo split of the ~500 estimate. Not a head count. */
export const DEMO_SPLIT: Record<AviarySpeciesId, number> = { toucan: 60, parrot: 180, flamingo: 120, other: 140 };

const HOME_ZONES: Record<AviarySpeciesId, string[]> = {
  toucan: ["canopy-walk", "nesting-trees", "feeding-platform"],
  parrot: ["canopy-walk", "nesting-trees", "feeding-platform", "rainforest-floor"],
  flamingo: ["flamingo-lagoon", "waterfall-pool"],
  other: ["rainforest-floor", "waterfall-pool", "canopy-walk", "feeding-platform", "nesting-trees"],
};

const NAMES = ["Mango", "Kiwi", "Sol", "Coral", "Pico", "Luna", "Zara", "Tango", "Rio", "Nova", "Sunny", "Azul", "Jade", "Ruby", "Olive", "Indy", "Saffron", "Echo", "Pepper", "Iris"];

const NOTES = [
  "Seen preening, normal posture.",
  "Took food at the morning feed.",
  "Perched with its usual group.",
  "Vocalising at the feeding station.",
  "Bathing at the pool edge.",
];

function teamForZone(zoneId: string) {
  return AVIARY_TEAMS.find((t) => t.zoneIds.includes(zoneId))?.id ?? "ground";
}

export function generateAviary(now: number, seed = 20261027): AviaryDataset {
  const rng: Rng = mulberry32(hashSeed("aviary", seed));
  const windowStart = startOfDay(now) - (AVIARY_HISTORY_DAYS - 1) * DAY;
  const birds: Bird[] = [];
  const observations = new Map<string, BirdObservation[]>();
  let obsId = 0;

  for (const sp of AVIARY_SPECIES) {
    for (let i = 1; i <= DEMO_SPLIT[sp.id]; i++) {
      const id = `${sp.code}-${String(i).padStart(3, "0")}`;
      const homes = HOME_ZONES[sp.id];
      const home = pick(rng, homes);
      const bird: Bird = {
        id,
        name: chance(rng, 0.12) ? pick(rng, NAMES) : undefined,
        speciesId: sp.id,
        bandId: `BND-${hashSeed(id, seed).toString(16).slice(0, 5).toUpperCase()}`,
        teamId: teamForZone(home),
        registeredAt: now - Math.round(between(rng, 60, 2200)) * DAY,
        simulated: true,
      };

      // A few birds spend the window off exhibit.
      const inCare = chance(rng, 0.015);
      const team = AVIARY_TEAMS.find((t) => t.id === (inCare ? "avian-vet" : bird.teamId))!;
      if (inCare) bird.teamId = "avian-vet";
      // Some birds are seen less often, so "not observed lately" has real cases.
      const seenRate = chance(rng, 0.04) ? 0.12 : between(rng, 0.45, 0.85);

      const list: BirdObservation[] = [];
      for (let d = 0; d < AVIARY_HISTORY_DAYS; d++) {
        const day = windowStart + d * DAY;
        if (!chance(rng, seenRate)) continue;
        const times = chance(rng, 0.3) ? 2 : 1;
        for (let k = 0; k < times; k++) {
          const at = day + Math.round(between(rng, 7, 17.5) * HOUR) + Math.round(rng() * 59) * MIN;
          if (at > now) continue;
          const zoneId = inCare ? "avian-care" : chance(rng, 0.78) ? home : chance(rng, 0.03) ? "holding" : pick(rng, homes);
          const kind: ObservationKind = chance(rng, 0.25) ? "feeding" : chance(rng, 0.15) ? "headcount" : chance(rng, 0.1) ? "note" : "sighting";
          list.push({
            id: `obs-${++obsId}`,
            birdId: id,
            at,
            zoneId,
            kind,
            by: pick(rng, team.members),
            text: kind === "note" ? pick(rng, NOTES) : undefined,
            simulated: true,
          });
        }
      }
      list.sort((a, b) => a.at - b.at);
      birds.push(bird);
      observations.set(id, list);
    }
  }

  return { now, windowStart, birds, observations };
}

/** Sanity check used by the UI: the demo roster stands in for the estimate. */
export const DEMO_TOTAL = Object.values(DEMO_SPLIT).reduce((a, b) => a + b, 0);
if (DEMO_TOTAL !== AVIARY_ESTIMATE.birds) {
  // Kept as a dev-time hint; the UI always labels the roster as demo data.
  console.warn(`Aviary demo roster has ${DEMO_TOTAL} birds, estimate is ${AVIARY_ESTIMATE.birds}.`);
}
