"use client";

import { useCallback, useState } from "react";
import type { DemoRegistry, MonitorBird } from "@/domain/aviaryTracking";
import { defaultTeam, loadTeamOverrides, saveTeamOverrides, type TeamId, type TeamOverrides } from "@/data/aviaryTeams";

/** Team of each bird (default split plus the user's changes) and a way to change it. */
export function useTeamAssignments(registry: DemoRegistry) {
  const [overrides, setOverrides] = useState<TeamOverrides>(() => loadTeamOverrides(registry));
  const teamOf = useCallback((bird: MonitorBird): TeamId => overrides[bird.id] ?? defaultTeam(bird, registry), [overrides, registry]);
  const assign = useCallback(
    (bird: MonitorBird, team: TeamId) => {
      setOverrides((cur) => {
        const next = { ...cur };
        if (team === defaultTeam(bird, registry)) delete next[bird.id];
        else next[bird.id] = team;
        saveTeamOverrides(registry, next);
        return next;
      });
    },
    [registry],
  );
  const changed = Object.keys(overrides).length;
  return { teamOf, assign, changed };
}
