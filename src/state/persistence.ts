import type { DemoConfig } from "@/config/demo.config";
import type { CareNote, CareTeam, HealthCase, Incident, Shift } from "@/domain/types";
import type { Filters } from "@/logic/filters";

// v2: the UI moved to English; older saves held Spanish seed cases and log text.
const KEY = "penguin-demo/v2";

/**
 * The only thing stored in the browser: the user's decisions.
 * Readings are not stored; they are regenerated from the seed.
 */
export interface PersistedState {
  v: 1;
  savedNow: number;
  config: DemoConfig;
  assignments: Record<string, string>;
  log: Incident[];
  /** Observations logged in the demo (optional: absent in older versions). */
  userNotes?: CareNote[];
  /** Teams created and edited in the demo, their history and shifts (optional for compatibility). */
  customTeams?: CareTeam[];
  teamEdits?: Record<string, Partial<CareTeam>>;
  teamLog?: { id: string; teamId: string; at: number; by: string; text: string }[];
  shifts?: Shift[];
  /** Health follow-up cases (optional for compatibility: if missing, the scenario's are used). */
  cases?: HealthCase[];
  filters: Filters;
}

export function loadPersisted(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    return parsed?.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function savePersisted(s: PersistedState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // No storage (private mode, quota): the demo keeps running in memory.
  }
}

export function clearPersisted() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/**
 * Shifts everything saved forward in time so the previous session stays just
 * as "recent" relative to the scenario's new now.
 */
export function shiftPersisted(s: PersistedState, delta: number): PersistedState {
  if (!delta) return s;
  const h = <T extends { at: number }>(x: T) => ({ ...x, at: x.at + delta });
  return {
    ...s,
    log: s.log.map(h),
    userNotes: (s.userNotes ?? []).map(h),
    teamLog: (s.teamLog ?? []).map(h),
    cases: s.cases?.map((c) => ({
      ...c,
      openedAt: c.openedAt + delta,
      closedAt: c.closedAt === undefined ? undefined : c.closedAt + delta,
      entries: c.entries.map(h),
    })),
  };
}
