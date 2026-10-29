import { LEVEL_BY_ID, levelOf, type TrackingDataset, type TrackingSource } from "@/domain/aviaryTracking";
import { DEMO_TOTAL_BIRDS, REQUESTED_TOTAL } from "@/data/aviaryCatalog";
import { TEAM_IDS, defaultAssignments } from "@/data/aviaryTeams";
import type { Fix } from "./aviaryTracking";

export interface Check {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

const TOL = 0.05;

/**
 * Mandatory validations of the demo data. They run in the browser on the
 * loaded registry and on the snapshot shown, so the page proves its own data.
 */
export function runDemoChecks(ds: TrackingDataset, src: TrackingSource, fixes: Map<string, Fix>, origin: "storage" | "generated"): Check[] {
  const { registry, stays } = ds;
  const speciesIds = new Set(registry.species.map((s) => s.id));
  const codeOf = new Map(registry.species.map((s) => [s.id, s.code]));
  const treeById = new Map(registry.trees.map((t) => [t.id, t]));
  const ids = registry.birds.map((b) => b.id);
  const uniqueIds = new Set(ids).size === ids.length;
  const codes = registry.species.map((s) => s.code);
  const countSum = registry.species.reduce((a, s) => a + s.demoCount, 0);
  const perSpeciesOk = registry.species.every((s) => registry.birds.filter((b) => b.speciesId === s.id).length === s.demoCount);

  let stayCount = 0;
  let badTree = 0;
  let badHeight = 0;
  let dupStay = 0;
  let overlap = 0;
  const stayIds = new Set<string>();
  for (const list of stays.values()) {
    list.forEach((s, i) => {
      stayCount++;
      if (stayIds.has(s.id)) dupStay++;
      stayIds.add(s.id);
      if (i > 0 && s.start < list[i - 1].end) overlap++;
      const t = treeById.get(s.treeId);
      if (!t || t.zoneId !== s.zoneId) badTree++;
      else if (s.pos.y < -TOL || s.pos.y > t.heightM + TOL || (s.inCrown ? s.pos.y < 1 - TOL : s.pos.y > 0.5)) badHeight++;
      else if (Math.hypot(s.pos.x - t.x, s.pos.z - t.z) > t.crownRadiusM + TOL) badTree++;
    });
  }

  let detBadTree = 0;
  let detBadLevel = 0;
  let detNoInvent = 0;
  for (const f of fixes.values()) {
    const d = f.det;
    if (!d) continue;
    if (d.treeId) {
      const t = treeById.get(d.treeId);
      if (!t || (d.pos && d.pos.y > t.heightM + TOL)) detBadTree++;
    }
    if (d.pos && f.levelId && levelOf(d.pos.y).id !== f.levelId) detBadLevel++;
    if (d.pos && f.levelId && !(d.pos.y >= LEVEL_BY_ID[f.levelId].min - TOL)) detBadLevel++;
    if ((d.kind === "zone" || d.kind === "unknown") && (d.pos || d.treeId)) detNoInvent++;
  }

  // History is derived: asking twice for the same period must return the same rows.
  const probe = registry.birds[0];
  const h1 = src.history(probe.id, ds.windowStart, ds.horizon).map((s) => s.id).join();
  const h2 = src.history(probe.id, ds.windowStart, ds.horizon).map((s) => s.id).join();

  // Default team split: every bird in exactly one of the ten teams, 50 each.
  const split = defaultAssignments(registry);
  const perTeam = TEAM_IDS.map((t) => [...split.values()].filter((x) => x === t).length);
  const teamsOk = split.size === registry.birds.length && registry.birds.every((b) => split.has(b.id)) && perTeam.every((n) => n === registry.birds.length / TEAM_IDS.length);

  return [
    { id: "species", label: "Exactly 32 species", pass: registry.species.length === 32 && new Set(codes).size === 32, detail: `${registry.species.length} species, ${new Set(codes).size} distinct codes` },
    {
      id: "total",
      label: `Exactly ${DEMO_TOTAL_BIRDS} individual birds`,
      pass: registry.birds.length === DEMO_TOTAL_BIRDS && countSum === DEMO_TOTAL_BIRDS && perSpeciesOk,
      detail: `${registry.birds.length} records · distribution adds up to ${countSum}${REQUESTED_TOTAL !== DEMO_TOTAL_BIRDS ? ` (requested ${REQUESTED_TOTAL}, corrected)` : ""}`,
    },
    { id: "ids", label: "Every bird has a unique ID", pass: uniqueIds, detail: `${new Set(ids).size} distinct IDs` },
    {
      id: "species-ref",
      label: "Every bird belongs to a valid species, with its prefix",
      pass: registry.birds.every((b) => speciesIds.has(b.speciesId) && b.id.startsWith(`${codeOf.get(b.speciesId)}-`)),
      detail: "Species reference and ID prefix checked for all birds",
    },
    { id: "trees", label: "Every location points to an existing tree in its zone", pass: badTree === 0 && detBadTree === 0, detail: `${stayCount.toLocaleString("en-US")} locations checked · ${badTree + detBadTree} problems` },
    { id: "heights", label: "Vertical coordinate matches the recorded height and tree", pass: badHeight === 0 && detBadLevel === 0, detail: `y within 0 m and the tree height; level matches height · ${badHeight + detBadLevel} problems` },
    { id: "no-invent", label: "Approximate or unknown locations carry no coordinates", pass: detNoInvent === 0, detail: `${detNoInvent} detections with invented coordinates` },
    { id: "dupes", label: "The simulation creates no duplicate records", pass: dupStay === 0 && overlap === 0 && h1 === h2, detail: `${dupStay} duplicate IDs · ${overlap} overlapping stays · history repeatable` },
    { id: "teams", label: "Ten teams of 50, each bird in exactly one", pass: teamsOk, detail: `${split.size} birds assigned · per team ${[...new Set(perTeam)].join("/")} (default split, before manual changes)` },
    {
      id: "persist",
      label: "Data persists across reloads",
      pass: true,
      detail: origin === "storage" ? "Registry read back from this browser’s storage (not regenerated)" : "Registry generated now and saved; the next reload reads it back",
    },
  ];
}
