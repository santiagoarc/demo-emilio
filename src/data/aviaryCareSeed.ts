import type { BirdFollowKind, BirdFollowUp, BirdNote, FollowPriority } from "@/domain/aviaryCare";
import type { TrackingDataset } from "@/domain/aviaryTracking";
import { birdInsight, speciesFlightBaseline } from "@/logic/aviaryActivity";
import { hashSeed, mulberry32, pick } from "@/logic/rng";
import { DAY, HOUR } from "@/logic/time";
import { MONITOR_TEAM_BY_ID, defaultTeam } from "./aviaryTeams";

/**
 * Follow-ups and keeper notes the aviary starts with. They are picked from what the
 * tracking data shows (birds without signal, birds flying much less than usual)
 * plus a few routine ones, and are worded as things to check, never as diagnoses.
 */

const TITLES: Record<BirdFollowKind, string[]> = {
  activity: ["Activity pattern changed this week", "More time in one spot than usual"],
  flight: ["Flying much less than its usual days", "Short flights only since yesterday"],
  still: ["Long stretches without detected movement", "Perched in the same tree most of the day"],
  space: ["Stopped visiting its usual zone", "Moved to trees outside its home zone"],
  signal: ["No detections since the tag went quiet", "Tag not reporting"],
  vet: ["Routine veterinary check due", "Follow-up after the last vet visit"],
  incident: ["Keeper saw it chased at the feeding station", "Found on the ground near the boardwalk"],
};

const FIRST: Record<BirdFollowKind, string> = {
  activity: "Opened from the activity check. The team will watch it at the next rounds before deciding anything.",
  flight: "Opened from the activity check: flight time well below its previous days and its species. Watch at feeding and on the next rounds.",
  still: "Opened after several hours with no movement detected. Check visually on the next round.",
  space: "Its detections moved away from its usual zone. Check whether something changed in that area.",
  signal: "The tag stopped reporting. Locate the bird visually and check the tag.",
  vet: "Routine check scheduled with the veterinary team.",
  incident: "Logged by the keeper on duty. No injury seen at first look; keep an eye on it.",
};

const FOLLOW: string[] = [
  "Seen at the feeding station, eating normally.",
  "Checked on the round: perched, alert, preening.",
  "Short flights between two trees observed.",
  "No change since the last entry.",
];

export function seedAviaryCare(ds: TrackingDataset): { cases: BirdFollowUp[]; notes: BirdNote[] } {
  const { registry } = ds;
  const now = registry.anchor;
  const rng = mulberry32(hashSeed("aviary-care", registry.seed));
  const used = new Set<string>();
  const cases: BirdFollowUp[] = [];

  const add = (birdId: string, kind: BirdFollowKind, priority: FollowPriority, opts: { daysAgo: number; closed?: boolean; nextInDays?: number }) => {
    if (used.has(birdId)) return;
    used.add(birdId);
    const bird = registry.birds.find((b) => b.id === birdId)!;
    const team = MONITOR_TEAM_BY_ID[defaultTeam(bird, registry)];
    const openedAt = now - opts.daysAgo * DAY - Math.floor(rng() * 8) * HOUR;
    const id = `FU-${birdId}-${cases.length + 1}`;
    const entries = [{ id: `${id}-0`, at: openedAt, by: team.lead, text: FIRST[kind] }];
    const steps = Math.min(opts.daysAgo, 1 + Math.floor(rng() * 3));
    for (let i = 1; i <= steps; i++) {
      const at = Math.min(now - HOUR, openedAt + (i * (now - openedAt)) / (steps + 1));
      entries.unshift({ id: `${id}-${i}`, at: Math.round(at), by: pick(rng, team.members), text: pick(rng, FOLLOW) });
    }
    const closedAt = opts.closed ? Math.round(openedAt + (now - openedAt) * 0.8) : undefined;
    if (closedAt) entries.unshift({ id: `${id}-c`, at: closedAt, by: team.lead, text: "Back to its usual pattern. Closed." });
    cases.push({
      id,
      birdId,
      kind,
      title: pick(rng, TITLES[kind]),
      owner: team.lead,
      priority,
      openedAt,
      nextReviewAt: opts.closed ? undefined : opts.nextInDays !== undefined ? now + opts.nextInDays * DAY : undefined,
      status: opts.closed ? "closed" : "open",
      closedAt,
      entries,
      simulated: true,
    });
  };

  // Tags that stopped reporting.
  for (const b of registry.birds.filter((x) => x.signalLostAt && x.signalLostAt <= now).slice(0, 2)) add(b.id, "signal", "high", { daysAgo: 1, nextInDays: 3.5 });

  // What the activity check flags.
  const baselines = new Map(registry.species.map((s) => [s.id, speciesFlightBaseline(ds, s.id, now)]));
  const flagged = registry.birds
    .filter((b) => b.device.status !== "intermittent" && !used.has(b.id))
    .map((b) => ({ b, ins: birdInsight(ds, b, now, baselines.get(b.speciesId) ?? null) }))
    .filter((x) => x.ins.level !== "ok");
  for (const x of flagged.filter((y) => y.ins.level === "check").slice(0, 3)) add(x.b.id, "flight", "high", { daysAgo: 2, nextInDays: 4 });
  for (const x of flagged.filter((y) => y.ins.level === "watch").slice(0, 3)) add(x.b.id, "activity", "medium", { daysAgo: 3, nextInDays: 5 });

  // Routine and keeper-logged ones, on birds picked at random.
  const others = registry.birds.filter((b) => !used.has(b.id));
  const plan: [BirdFollowKind, FollowPriority, number, number | undefined, boolean?][] = [
    ["still", "medium", 1, 4],
    ["space", "low", 4, 6],
    ["space", "medium", 2, 5],
    ["vet", "medium", 5, 4],
    ["vet", "low", 3, 9],
    ["incident", "medium", 0, 4],
    ["incident", "low", 2, 7],
    ["flight", "medium", 9, undefined, true],
    ["incident", "low", 12, undefined, true],
    ["vet", "low", 6, undefined, true],
  ];
  for (const [kind, priority, daysAgo, nextInDays, closed] of plan) add(pick(rng, others).id, kind, priority, { daysAgo, nextInDays, closed });

  // A few keeper observations, so profiles do not start empty.
  const notes: BirdNote[] = [];
  for (let i = 0; i < 24; i++) {
    const b = pick(rng, registry.birds);
    const team = MONITOR_TEAM_BY_ID[defaultTeam(b, registry)];
    notes.push({ id: `NOTE-${b.id}-${i}`, birdId: b.id, at: now - Math.floor(rng() * 6 * 24) * HOUR, by: pick(rng, team.members), text: pick(rng, FOLLOW), simulated: true });
  }
  return { cases, notes };
}
