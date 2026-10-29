/**
 * Health follow-up cases the demo starts with. They are fictional care logs
 * generated from the same seed as the rest of the scenario.
 */
import type { Dataset, HealthCase, HealthReason } from "@/domain/types";
import { between, hashSeed, mulberry32, pick } from "@/logic/rng";
import { DAY, HOUR } from "@/logic/time";

interface Template {
  reason: HealthReason;
  title: string;
  notes: string[];
  weight?: [number, number]; // starting kg and total change over the case
}

const TEMPLATES: Template[] = [
  {
    reason: "injury",
    title: "Mild limp, left foot",
    notes: ["Limp observed while walking on the beach; swims without difficulty.", "Vet check logged: no fracture, mild swelling. Limited activity.", "Walking better; remains under observation."],
  },
  {
    reason: "weight",
    title: "Weight loss over recent weeks",
    notes: ["Weigh-in below its usual range.", "Ration adjusted; intake now logged at every feeding.", "Ate its full ration at the last two feedings."],
    weight: [4.9, 0.25],
  },
  {
    reason: "molt",
    title: "Catastrophic molt",
    notes: ["Molt begins; spending more time on land and not entering the water.", "Extra feeding during the molt.", "Molt well advanced; new plumage on the back."],
    weight: [5.6, -0.45],
  },
  {
    reason: "treatment",
    title: "Bumblefoot treatment",
    notes: ["Lesion on the sole of the right foot; topical treatment started.", "Daily dressing; the lesion looks cleaner.", "Substrate changed in its resting area."],
  },
  {
    reason: "behavior",
    title: "Spending little time in the water",
    notes: ["Team notes it enters the water less than its group.", "No visible clinical signs; daily activity being followed in the system."],
  },
  {
    reason: "weight",
    title: "Post-treatment weight check",
    notes: ["Treatment finished; weighed every third day.", "Regaining weight as expected."],
    weight: [3.8, 0.3],
  },
];

const OWNER_BY_REASON: Record<HealthReason, "vet" | "team"> = { injury: "vet", weight: "team", molt: "team", treatment: "vet", behavior: "team", other: "team" };

export function seedHealthCases(ds: Dataset, seed: number): HealthCase[] {
  const rng = mulberry32(hashSeed(seed, "health-cases"));
  const used = new Set<string>();
  const vet = ds.teams.find((t) => t.id === "vet");
  const cases: HealthCase[] = [];

  TEMPLATES.forEach((tpl, i) => {
    let p = pick(rng, ds.penguins);
    for (let k = 0; k < 10 && used.has(p.id); k++) p = pick(rng, ds.penguins);
    if (used.has(p.id)) return;
    used.add(p.id);
    const team = ds.teams.find((t) => t.id === p.initialTeamId);
    const owner = OWNER_BY_REASON[tpl.reason] === "vet" ? (vet?.lead ?? "Veterinary team") : (team?.lead ?? "Care team");
    const openedAt = ds.now - between(rng, 3, 12) * DAY;
    const closed = i === TEMPLATES.length - 1; // one already closed, so there is some history
    const span = (closed ? openedAt + 6 * DAY : ds.now - 2 * HOUR) - openedAt;
    const entries = tpl.notes.map((text, k) => {
      const at = Math.round(openedAt + (span * k) / Math.max(1, tpl.notes.length - 1));
      const weightKg = tpl.weight ? Math.round((tpl.weight[0] + (tpl.weight[1] * k) / Math.max(1, tpl.notes.length - 1)) * 100) / 100 : undefined;
      const by = k === 0 || OWNER_BY_REASON[tpl.reason] === "team" ? owner : pick(rng, vet?.members ?? [owner]);
      return { id: `HC-${p.id}-${k}`, at, by, text, weightKg };
    });
    cases.push({
      id: `HC-${p.id}`,
      penguinId: p.id,
      reason: tpl.reason,
      title: tpl.title,
      owner,
      openedAt,
      status: closed ? "closed" : "open",
      closedAt: closed ? openedAt + 6 * DAY : undefined,
      entries: entries.reverse(),
      simulated: true,
    });
  });
  return cases;
}
