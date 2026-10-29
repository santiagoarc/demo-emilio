import type { DemoRegistry } from "@/domain/aviaryTracking";
import { DEMO_TOTAL_BIRDS, MONITOR_SPECIES } from "@/data/aviaryCatalog";
import { REGISTRY_VERSION, generateRegistry } from "@/data/aviaryTrackingSimulate";

/**
 * Persistence for the aviary demo. The project has no database, so the
 * registry (species, 500 birds, trees) is stored in this browser's
 * localStorage the first time and read back on every later load: reloading
 * never duplicates or re-creates it. Movements and detections are derived
 * from the stored registry and its seed, so they come back identical too.
 */

const REGISTRY_KEY = "aviary-demo/registry/v1";
const CLOCK_KEY = "aviary-demo/clock/v1";

export type RegistryOrigin = "storage" | "generated";

/** Structural check of a stored registry; anything off means it is regenerated. */
function looksValid(r: unknown): r is DemoRegistry {
  const x = r as DemoRegistry;
  return (
    !!x &&
    x.version === REGISTRY_VERSION &&
    Array.isArray(x.birds) &&
    x.birds.length === DEMO_TOTAL_BIRDS &&
    Array.isArray(x.trees) &&
    x.trees.length > 0 &&
    Array.isArray(x.species) &&
    x.species.length === MONITOR_SPECIES.length &&
    x.species.every((s, i) => s.code === MONITOR_SPECIES[i].code && s.demoCount === MONITOR_SPECIES[i].demoCount) &&
    typeof x.anchor === "number"
  );
}

export function loadRegistry(): { registry: DemoRegistry; origin: RegistryOrigin } {
  try {
    const raw = window.localStorage.getItem(REGISTRY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (looksValid(parsed)) return { registry: parsed, origin: "storage" };
  } catch {
    // Unreadable storage: fall through and generate.
  }
  const registry = generateRegistry();
  try {
    window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // No storage (private mode, quota): the demo still works for this session.
  }
  return { registry, origin: "generated" };
}

/** Forget the stored demo data so the next load generates a fresh registry. */
export function clearDemoStorage() {
  try {
    window.localStorage.removeItem(REGISTRY_KEY);
    window.localStorage.removeItem(CLOCK_KEY);
  } catch {}
}

/** Speeds offered by the clock controls (simulated seconds per real second). */
export const CLOCK_SPEEDS = [1, 5, 20];

export interface ClockState {
  simTime: number;
  /** Simulated seconds per real second. */
  speed: number;
  playing: boolean;
}

export function loadClock(registry: DemoRegistry): ClockState {
  const fallback: ClockState = { simTime: registry.anchor, speed: 5, playing: true };
  try {
    const raw = window.localStorage.getItem(CLOCK_KEY);
    const c = raw ? (JSON.parse(raw) as ClockState & { anchor?: number }) : null;
    if (c && c.anchor === registry.anchor && typeof c.simTime === "number" && typeof c.speed === "number") return { simTime: c.simTime, speed: CLOCK_SPEEDS.includes(c.speed) ? c.speed : fallback.speed, playing: !!c.playing };
  } catch {}
  return fallback;
}

export function saveClock(registry: DemoRegistry, c: ClockState) {
  try {
    window.localStorage.setItem(CLOCK_KEY, JSON.stringify({ ...c, anchor: registry.anchor }));
  } catch {}
}
