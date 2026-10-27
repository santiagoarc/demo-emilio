import type { Dataset, SpeciesId } from "@/domain/types";
import { DAY, HOUR, fmtDate, fromDateInput, startOfDay } from "./time";

export type RangePreset = "today" | "24h" | "7d" | "14d" | "custom";

export interface Filters {
  species: SpeciesId[];
  teams: string[];
  zones: string[];
  penguinId: string | null;
  range: RangePreset;
  customFrom?: string; // yyyy-mm-dd
  customTo?: string;
}

export const EMPTY_FILTERS: Filters = { species: [], teams: [], zones: [], penguinId: null, range: "24h" };

export const RANGE_LABEL: Record<RangePreset, string> = {
  today: "Today",
  "24h": "Last 24 h",
  "7d": "7 days",
  "14d": "14 days",
  custom: "Custom",
};

export interface ResolvedRange {
  from: number;
  to: number;
  label: string;
}

export function resolveRange(f: Filters, ds: Dataset): ResolvedRange {
  const now = ds.now + ds.slotMinutes * 60_000; // includes the current interval
  const clamp = (t: number) => Math.min(Math.max(t, ds.windowStart), now);
  switch (f.range) {
    case "today":
      return { from: clamp(startOfDay(ds.now)), to: now, label: "Today" };
    case "24h":
      return { from: clamp(now - 24 * HOUR), to: now, label: "Last 24 h" };
    case "7d":
      return { from: clamp(now - 7 * DAY), to: now, label: "Last 7 days" };
    case "14d":
      return { from: ds.windowStart, to: now, label: "Last 14 days" };
    case "custom": {
      const from = clamp(f.customFrom ? fromDateInput(f.customFrom) : now - 7 * DAY);
      const to = clamp(f.customTo ? fromDateInput(f.customTo) + DAY : now);
      if (to <= from) return { from, to: from, label: "Empty range" };
      return { from, to, label: `${fmtDate(from)} – ${fmtDate(to - 1)}` };
    }
  }
}

export function activeFilterCount(f: Filters): number {
  return f.species.length + f.teams.length + f.zones.length + (f.penguinId ? 1 : 0);
}
