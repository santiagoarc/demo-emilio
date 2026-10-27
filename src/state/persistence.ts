import type { DemoConfig } from "@/config/demo.config";
import type { CareNote, CareTeam, HealthCase, Incident, Shift } from "@/domain/types";
import type { Filters } from "@/logic/filters";

const KEY = "penguin-demo/v1";

/**
 * Lo único que se guarda en el navegador: las decisiones del usuario.
 * Las lecturas no se guardan; se regeneran desde la semilla.
 */
export interface PersistedState {
  v: 1;
  savedNow: number;
  config: DemoConfig;
  assignments: Record<string, string>;
  log: Incident[];
  /** Observaciones registradas en la demo (opcional: no existía en versiones anteriores). */
  userNotes?: CareNote[];
  /** Equipos creados y editados en la demo, su historial y turnos (opcionales por compatibilidad). */
  customTeams?: CareTeam[];
  teamEdits?: Record<string, Partial<CareTeam>>;
  teamLog?: { id: string; teamId: string; at: number; by: string; text: string }[];
  shifts?: Shift[];
  /** Casos de seguimiento de salud (opcional por compatibilidad: si falta, se usan los del escenario). */
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
    // Sin almacenamiento (modo privado, cuota): la demo sigue en memoria.
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
 * Corre en el tiempo todo lo guardado para que la sesión anterior quede igual
 * de "reciente" respecto al nuevo ahora del escenario.
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
