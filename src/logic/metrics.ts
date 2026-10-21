/**
 * Agregados de actividad. Todo se calcula desde las lecturas individuales y
 * los huecos registrados, nunca desde cifras escritas a mano.
 *
 * Cada lectura representa un intervalo de `slotMinutes`. El tiempo "en agua"
 * o "en tierra" es tiempo REGISTRADO; lo que no tiene lectura se reporta
 * aparte como "sin posición" o "sin comunicación", nunca se reparte.
 */
import type { Dataset } from "@/domain/types";
import { firstIndexAtOrAfter } from "./status";
import { DAY, MIN, startOfDay } from "./time";

export interface Breakdown {
  water: number;
  land: number;
  stationary: number; // subconjunto de land: lecturas repetidas en la misma posición
  noFix: number; // dispositivo comunica, sin posición
  noComm: number; // dispositivo sin comunicación
  expected: number; // tiempo cubierto por el periodo desde el alta
  readings: number;
}

export const emptyBreakdown = (): Breakdown => ({ water: 0, land: 0, stationary: 0, noFix: 0, noComm: 0, expected: 0, readings: 0 });

export interface DayBucket extends Breakdown {
  day: number;
}

export interface ActivityAggregate {
  from: number;
  to: number;
  penguinCount: number;
  totals: Breakdown;
  perPenguin: Map<string, Breakdown>;
  hourly: Breakdown[]; // 24 posiciones
  daily: DayBucket[];
  transitions: Map<string, number>; // "origen>destino"
  zoneTime: Map<string, number>;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

export function computeActivity(ds: Dataset, penguinIds: string[], from: number, to: number, zones?: Set<string>): ActivityAggregate {
  const slot = ds.slotMinutes * MIN;
  const zoneFiltered = !!zones && zones.size > 0;
  const totals = emptyBreakdown();
  const perPenguin = new Map<string, Breakdown>();
  const hourly = Array.from({ length: 24 }, emptyBreakdown);
  const dayStarts: number[] = [];
  for (let d = startOfDay(from); d < to; d += DAY) dayStarts.push(d);
  const daily: DayBucket[] = dayStarts.map((day) => ({ day, ...emptyBreakdown() }));
  const dayIndex = (t: number) => Math.min(daily.length - 1, Math.max(0, Math.floor((startOfDay(t) - dayStarts[0]) / DAY)));
  const transitions = new Map<string, number>();
  const zoneTime = new Map<string, number>();
  const byId = new Map(ds.penguins.map((p) => [p.id, p]));

  for (const id of penguinIds) {
    const p = byId.get(id);
    if (!p) continue;
    const b = emptyBreakdown();
    const start = Math.max(from, p.registeredAt, ds.windowStart);
    b.expected = Math.max(0, to - start);

    const list = ds.readings.get(id) ?? [];
    let prevX = NaN, prevY = NaN, prevT = -Infinity;
    for (let i = firstIndexAtOrAfter(list, from); i < list.length; i++) {
      const r = list[i];
      if (r.timestamp >= to) break;
      const sameSpot = r.x === prevX && r.y === prevY && r.timestamp - prevT <= slot;
      prevX = r.x;
      prevY = r.y;
      prevT = r.timestamp;
      if (zoneFiltered && !zones!.has(r.zoneId)) continue;
      const hb = hourly[new Date(r.timestamp).getHours()];
      const db = daily[dayIndex(r.timestamp)];
      for (const target of [b, hb, db]) {
        target.readings++;
        if (r.medium === "water") target.water += slot;
        else {
          target.land += slot;
          if (sameSpot) target.stationary += slot;
        }
      }
      zoneTime.set(r.zoneId, (zoneTime.get(r.zoneId) ?? 0) + slot);
    }

    if (!zoneFiltered) {
      for (const g of ds.gaps.get(id) ?? []) {
        if (g.end <= start || g.start >= to) continue;
        for (let t = Math.max(g.start, start); t < Math.min(g.end, to); t += slot) {
          const key = g.kind === "no_fix" ? "noFix" : "noComm";
          b[key] += slot;
          hourly[new Date(t).getHours()][key] += slot;
          daily[dayIndex(t)][key] += slot;
        }
      }
    }

    const recs = ds.activity.get(id) ?? [];
    for (let i = 1; i < recs.length; i++) {
      const a = recs[i - 1], c = recs[i];
      if (c.start < from || c.start >= to) continue;
      if (a.zoneId === c.zoneId || c.start - a.end > 0) continue; // con hueco no se cuenta como transición observada
      if (zoneFiltered && !zones!.has(a.zoneId) && !zones!.has(c.zoneId)) continue;
      const key = `${a.zoneId}>${c.zoneId}`;
      transitions.set(key, (transitions.get(key) ?? 0) + 1);
    }

    perPenguin.set(id, b);
    for (const k of Object.keys(totals) as (keyof Breakdown)[]) totals[k] += b[k];
  }

  for (const d of daily) d.expected = overlap(d.day, d.day + DAY, from, to) * penguinIds.length;
  for (let h = 0; h < 24; h++) hourly[h].expected = hourly[h].water + hourly[h].land + hourly[h].noFix + hourly[h].noComm;

  return { from, to, penguinCount: penguinIds.length, totals, perPenguin, hourly, daily, transitions, zoneTime };
}

/** Promedio por ejemplar por día, en ms. */
export function perPenguinPerDay(value: number, penguins: number, from: number, to: number): number {
  const days = Math.max((to - from) / DAY, 1 / 48);
  return penguins ? value / penguins / days : 0;
}

export function sumBreakdowns(items: Breakdown[]): Breakdown {
  const out = emptyBreakdown();
  for (const b of items) for (const k of Object.keys(out) as (keyof Breakdown)[]) out[k] += b[k];
  return out;
}
