import type { DemoRegistry, MonitorBird, SpeciesGroup } from "@/domain/aviaryTracking";

/**
 * Aviary monitoring teams (DEMO). Every bird belongs to exactly one team.
 *
 * Default split: birds ordered by species group and species, then cut into
 * ten blocks of 50, so each team follows a few related species and the
 * total is exactly the registry. Changes made in the UI are stored as
 * per-bird overrides in this browser and win over the default.
 */

export const TEAM_IDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet"] as const;
export type TeamId = (typeof TEAM_IDS)[number];

export interface MonitorTeam {
  id: TeamId;
  name: string;
  /** Fictional lead, for the demo. */
  lead: string;
}

const LEADS = ["Lucía Ferrer", "Omar Haddad", "Grace Lin", "Tomás Herrera", "Aisha Rahman", "Ben Carter", "Renata Campos", "Yusuf Ali", "Mia Novak", "Karim Nasser"];

export const MONITOR_TEAMS: MonitorTeam[] = TEAM_IDS.map((id, i) => ({ id, name: `Team ${id[0].toUpperCase()}${id.slice(1)}`, lead: LEADS[i] }));

export const MONITOR_TEAM_BY_ID = Object.fromEntries(MONITOR_TEAMS.map((t) => [t.id, t])) as Record<TeamId, MonitorTeam>;

const GROUP_ORDER: SpeciesGroup[] = ["toucan", "parrot", "turaco", "wader", "pigeon", "galliform", "other"];

const cache = new WeakMap<DemoRegistry, Map<string, TeamId>>();

/** Default team of every bird: equal blocks over birds sorted by group and species. */
export function defaultAssignments(registry: DemoRegistry): Map<string, TeamId> {
  const hit = cache.get(registry);
  if (hit) return hit;
  const spIndex = new Map(registry.species.map((s, i) => [s.id, i]));
  const spGroup = new Map(registry.species.map((s) => [s.id, s.group]));
  const ordered = [...registry.birds].sort(
    (a, b) =>
      GROUP_ORDER.indexOf(spGroup.get(a.speciesId)!) - GROUP_ORDER.indexOf(spGroup.get(b.speciesId)!) ||
      spIndex.get(a.speciesId)! - spIndex.get(b.speciesId)! ||
      a.seq - b.seq,
  );
  const size = Math.ceil(ordered.length / TEAM_IDS.length);
  const out = new Map<string, TeamId>(ordered.map((b, i) => [b.id, TEAM_IDS[Math.min(TEAM_IDS.length - 1, Math.floor(i / size))]]));
  cache.set(registry, out);
  return out;
}

export function defaultTeam(bird: MonitorBird, registry: DemoRegistry): TeamId {
  return defaultAssignments(registry).get(bird.id) ?? "alpha";
}

/** Per-bird reassignments, keyed to the registry they were made on. */
export type TeamOverrides = Record<string, TeamId>;

const KEY = "aviary-demo/teams/v2";

export function loadTeamOverrides(registry: DemoRegistry): TeamOverrides {
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as { createdAt: number; overrides: TeamOverrides }) : null;
    if (saved && saved.createdAt === registry.createdAt && saved.overrides && typeof saved.overrides === "object") {
      return Object.fromEntries(Object.entries(saved.overrides).filter(([, t]) => (TEAM_IDS as readonly string[]).includes(t)));
    }
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
