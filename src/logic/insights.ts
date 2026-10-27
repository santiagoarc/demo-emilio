/**
 * "¿Cómo va?" de cada pingüino: compara sus últimos días contra él mismo y contra
 * su especie, con las mismas cifras de actividad que el resto de la demo.
 * No es diagnóstico: señala lo que conviene mirar.
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
  /** Horas por día en las últimas 24 h y el promedio de la especie. */
  water: { mine: number; species: number };
  land: { mine: number; species: number };
  coverage: number; // 0–1, tiempo con lectura sobre tiempo esperado (24 h)
}

export const INSIGHT_LABEL: Record<InsightLevel, string> = { ok: "Va bien", watch: "Vigilar", check: "Revisar" };

const perDay = (b: Breakdown, days: number) => ({ water: b.water / days / HOUR, land: b.land / days / HOUR, stationary: b.stationary / days / HOUR });

/** Promedio diario por especie en la ventana disponible; se calcula una vez por dataset. */
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

  // Un día en el agua varía mucho: solo cuenta lo que se sale con claridad.
  // "Revisar" pide que esté bajo contra su especie y también contra sus propios días.
  // Un ejemplar recién dado de alta aún no tiene un día completo que comparar.
  if (coverage >= 0.6) {
    const vsSpecies = base.water > 0 ? today.water / base.water : 1;
    const vsSelf = before.water > 0.5 ? today.water / before.water : 1;
    if (vsSpecies < 0.3 && vsSelf < 0.5) {
      points.push({ level: "check", text: `Nadó ${today.water.toFixed(1)} h en 24 h: menos de la mitad que en sus días anteriores (${before.water.toFixed(1)} h) y muy por debajo de su especie (${base.water.toFixed(1)} h).` });
    } else if (vsSpecies < 0.45 && vsSelf < 0.6) {
      points.push({ level: "watch", text: `Nadó ${today.water.toFixed(1)} h en 24 h, por debajo de su especie (${base.water.toFixed(1)} h) y de sus días anteriores (${before.water.toFixed(1)} h).` });
    } else if (vsSpecies < 0.4) {
      points.push({ level: "watch", text: `Nadó ${today.water.toFixed(1)} h en 24 h, muy por debajo de su especie (${base.water.toFixed(1)} h), aunque es parecido a sus días anteriores.` });
    } else if (vsSelf < 0.4 && before.water - today.water > 1.5) {
      points.push({ level: "watch", text: `Bajó su tiempo en agua: ${today.water.toFixed(1)} h hoy vs ${before.water.toFixed(1)} h en sus días anteriores.` });
    } else if (vsSpecies > 2.2) {
      points.push({ level: "watch", text: `Nadó ${today.water.toFixed(1)} h en 24 h, más del doble que su especie (${base.water.toFixed(1)} h).` });
    }

    const still = base.stationary > 0 ? today.stationary / base.stationary : 1;
    if (today.stationary >= 4 && still > 1.8) points.push({ level: "watch", text: `${today.stationary.toFixed(1)} h sin movimiento registrado, más de lo usual en su especie (${base.stationary.toFixed(1)} h).` });
  }

  const level: InsightLevel = points.some((x) => x.level === "check") ? "check" : points.some((x) => x.level === "watch") ? "watch" : "ok";
  if (level === "ok") points.unshift({ level: "ok", text: `Actividad dentro de lo usual: ${today.water.toFixed(1)} h en agua y ${today.land.toFixed(1)} h en tierra en las últimas 24 h.` });
  const headline =
    level === "ok" ? "Actividad normal para su especie" : level === "watch" ? "Algo cambió; conviene vigilar" : "Conviene revisarlo";

  return {
    level,
    headline,
    points,
    water: { mine: today.water, species: base.water },
    land: { mine: today.land, species: base.land },
    coverage,
  };
}
