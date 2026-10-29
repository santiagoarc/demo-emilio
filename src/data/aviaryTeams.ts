import type { DemoRegistry, MonitorBird, SpeciesGroup } from "@/domain/aviaryTracking";

/**
 * Aviary monitoring teams (DEMO). Every bird belongs to exactly one team.
 *
 * The default split follows species groups so each team watches a coherent
 * set of species; it is only a starting point. Changes made in the UI are
 * stored as per-bird overrides in this browser and win over the default.
 */

export type TeamId = "alpha" | "bravo" | "charlie";

export interface MonitorTeam {
  id: TeamId;
  name: string;
  /** Fictional lead, for the demo. */
  lead: string;
  /** What the default split gives the team. */
  focus: string;
}

export const MONITOR_TEAMS: MonitorTeam[] = [
  { id: "alpha", name: "Team Alpha", lead: "Lucía Ferrer", focus: "Toucans, parrots and macaws" },
  { id: "bravo", name: "Team Bravo", lead: "Omar Haddad", focus: "Ibises, spoonbill, stork and turacos" },
  { id: "charlie", name: "Team Charlie", lead: "Grace Lin", focus: "Pigeons, pheasants and other species" },
];

export const MONITOR_TEAM_BY_ID = Object.fromEntries(MONITOR_TEAMS.map((t) => [t.id, t])) as Record<TeamId, MonitorTeam>;

const DEFAULT_BY_GROUP: Record<SpeciesGroup, TeamId> = {
  toucan: "alpha",
  parrot: "alpha",
  wader: "bravo",
  turaco: "bravo",
  pigeon: "charlie",
  galliform: "charlie",
  other: "charlie",
};

export function defaultTeam(bird: MonitorBird, registry: DemoRegistry): TeamId {
  const sp = registry.species.find((s) => s.id === bird.speciesId);
  return sp ? DEFAULT_BY_GROUP[sp.group] : "charlie";
}

/** Per-bird reassignments, keyed to the registry they were made on. */
export type TeamOverrides = Record<string, TeamId>;

const KEY = "aviary-demo/teams/v1";

export function loadTeamOverrides(registry: DemoRegistry): TeamOverrides {
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as { createdAt: number; overrides: TeamOverrides }) : null;
    if (saved && saved.createdAt === registry.createdAt && saved.overrides && typeof saved.overrides === "object") return saved.overrides;
  } catch {}
  return {};
}

export function saveTeamOverrides(registry: DemoRegistry, overrides: TeamOverrides) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ createdAt: registry.createdAt, overrides }));
  } catch {
    // No storage: changes last for this session only.
  }
}
