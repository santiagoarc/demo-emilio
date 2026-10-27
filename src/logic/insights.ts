/**
 * "How is it doing?" for each penguin: compares its last few days against itself and
 * against its species, using the same activity figures as the rest of the demo.
 * Not a diagnosis: it only points at what may be worth a look.
 */
import type { Dataset, Penguin } from "@/domain/types";
import { computeActivity, type Breakdown } from "./metrics";
import { DAY, HOUR } from "./time";

export type InsightLevel = "ok" | "watch" | "check";

export interface InsightPoint {
  level: InsightLevel;
  text: string;
}

export interface PenguinInsight {
  level: InsightLevel;
  headline: string;
  points: InsightPoint[];
  /** Hours per day over the last 24 h, and the species average. */
  water: { mine: number; species: number };
  land: { mine: number; species: number };
  coverage: number; // 0–1, time with readings over expected time (24 h)
}

export const INSIGHT_LABEL: Record<InsightLevel, string> = { ok: "Typical", watch: "Watch", check: "Review" };

const perDay = (b: Breakdown, days: number) => ({ water: b.water / days / HOUR, land: b.land / days / HOUR, stationary: b.stationary / days / HOUR });

/** Daily average per species over the available window; computed once per dataset. */
export function speciesBaselines(ds: Dataset): Map<string, { water: number; land: number; stationary: number }> {
  const out = new Map<string, { water: number; land: number; stationary: number }>();
  const days = Math.max(1, (ds.now - ds.windowStart) / DAY);
  for (const sp of ds.species) {
    const ids = ds.penguins.filter((p) => p.speciesId === sp.id).map((p) => p.id);
    if (!ids.length) continue;
    const t = computeActivity(ds, ids, ds.windowStart, ds.now).totals;
    const d = perDay(t, days * ids.length);
    out.set(sp.id, d);
  }
  return out;
}

export function penguinInsight(
  ds: Dataset,
  p: Penguin,
  baseline: { water: number; land: number; stationary: number } | undefined,
): PenguinInsight {
  const now = ds.now;
  const day = computeActivity(ds, [p.id], now - DAY, now).totals;
  const from = Math.max(ds.windowStart, p.registeredAt);
  const prevDays = Math.max(1, (now - DAY - from) / DAY);
  const before = perDay(computeActivity(ds, [p.id], from, now - DAY).totals, prevDays);
  const today = perDay(day, 1);
  const base = baseline ?? today;
  const coverage = day.expected > 0 ? (day.water + day.land) / day.expected : 0;
  const points: InsightPoint[] = [];

  // Time in the water varies a lot day to day: only clear outliers count.
  // "Review" requires being low against the species AND against its own previous days.
  // A newly admitted penguin doesn't have a full day to compare yet.
  if (coverage >= 0.6) {
    const vsSpecies = base.water > 0 ? today.water / base.water : 1;
    const vsSelf = before.water > 0.5 ? today.water / before.water : 1;
    if (vsSpecies < 0.3 && vsSelf < 0.5) {
      points.push({ level: "check", text: `Recorded ${today.water.toFixed(1)} h in the water in the last 24 h: less than half its previous days (${before.water.toFixed(1)} h) and well below its species (${base.water.toFixed(1)} h).` });
    } else if (vsSpecies < 0.45 && vsSelf < 0.6) {
      points.push({ level: "watch", text: `Recorded ${today.water.toFixed(1)} h in the water in the last 24 h, below its species (${base.water.toFixed(1)} h) and its previous days (${before.water.toFixed(1)} h).` });
    } else if (vsSpecies < 0.4) {
      points.push({ level: "watch", text: `Recorded ${today.water.toFixed(1)} h in the water in the last 24 h, well below its species (${base.water.toFixed(1)} h), though similar to its own previous days.` });
    } else if (vsSelf < 0.4 && before.water - today.water > 1.5) {
      points.push({ level: "watch", text: `Less time in the water: ${today.water.toFixed(1)} h in the last 24 h vs ${before.water.toFixed(1)} h on its previous days.` });
    } else if (vsSpecies > 2.2) {
      points.push({ level: "watch", text: `Recorded ${today.water.toFixed(1)} h in the water in the last 24 h, more than twice its species (${base.water.toFixed(1)} h).` });
    }

    const still = base.stationary > 0 ? today.stationary / base.stationary : 1;
    if (today.stationary >= 4 && still > 1.8) points.push({ level: "watch", text: `${today.stationary.toFixed(1)} h with no movement recorded, more than usual for its species (${base.stationary.toFixed(1)} h).` });
  }

  const level: InsightLevel = points.some((x) => x.level === "check") ? "check" : points.some((x) => x.level === "watch") ? "watch" : "ok";
  if (level === "ok") points.unshift({ level: "ok", text: `Activity within the usual range: ${today.water.toFixed(1)} h in water and ${today.land.toFixed(1)} h on land in the last 24 h.` });
  const headline =
    level === "ok" ? "Activity typical for its species" : level === "watch" ? "Activity changed — worth watching" : "Activity pattern worth a keeper check";

  return {
    level,
    headline,
    points,
    water: { mine: today.water, species: base.water },
    land: { mine: today.land, species: base.land },
    coverage,
  };
}
