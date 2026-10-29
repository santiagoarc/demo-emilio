"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Users } from "lucide-react";
import { MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { MONITOR_TEAMS, type TeamId } from "@/data/aviaryTeams";
import { useTeamAssignments } from "@/state/useTeams";
import type { Fix } from "@/logic/aviaryTracking";
import { Card } from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/AppShell";
import { TeamsSection, monitorState } from "./AviaryPanels";
import { AviaryFrame, useAviarySnapshot } from "./common";
import { SpeciesAvatar } from "./SpeciesAvatar";

/** The ten monitoring teams: summary of each, and the same editable list as the map. */
export function AviaryTeamsView() {
  const { registry, fixes } = useAviarySnapshot();
  const { teamOf, assign, changed } = useTeamAssignments(registry);
  const router = useRouter();
  const all = useMemo(() => [...fixes.values()], [fixes]);
  const byTeam = useMemo(() => {
    const m = new Map<TeamId, Fix[]>(MONITOR_TEAMS.map((t) => [t.id, []]));
    for (const f of all) m.get(teamOf(f.bird))!.push(f);
    return m;
  }, [all, teamOf]);

  return (
    <div className="pb-12">
      <PageHeader
        eyebrow="Aviary · Teams"
        title="Monitoring teams"
        subtitle={`${MONITOR_TEAMS.length} demo teams share the ${registry.birds.length} birds; each bird belongs to exactly one. ${changed ? `${changed} birds reassigned by hand.` : "Default split: 50 birds each, by species group."}`}
      />
      <AviaryFrame banner="Teams, leads and assignments are fictional demo data.">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card title="Teams at a glance" icon={Users}>
            <div className="grid gap-2 sm:grid-cols-2">
              {MONITOR_TEAMS.map((team) => {
                const birds = byTeam.get(team.id)!;
                const st = monitorState(birds);
                const species = [...new Set(birds.map((f) => f.bird.speciesId))];
                return (
                  <article key={team.id} className="rounded-xl border border-line p-3">
                    <header className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-ink/[0.06] text-sm font-bold text-ink">{team.name.split(" ")[1][0]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-ink">{team.name}</p>
                        <p className="text-[11px] text-muted">Lead {team.lead}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: st.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                        {st.noSignal ? "Check" : "OK"}
                      </span>
                    </header>
                    <dl className="mt-2 grid grid-cols-4 gap-1 text-center">
                      {[
                        ["Birds", birds.length],
                        ["Species", species.length],
                        ["Detected", st.detected],
                        ["No signal", st.noSignal],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-md bg-ink/[0.035] px-1 py-1">
                          <dt className="text-[9px] uppercase tracking-wide text-faint">{k}</dt>
                          <dd className="num text-sm font-semibold text-ink">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="flex -space-x-1.5">
                        {species.slice(0, 6).map((sid) => (
                          <SpeciesAvatar key={sid} code={MONITOR_SPECIES_BY_ID[sid].code} size={22} title={MONITOR_SPECIES_BY_ID[sid].common} />
                        ))}
                      </span>
                      <Link href={`/aviary/map?team=${team.id}`} className="text-[11px] text-accent hover:underline">Show on map →</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>
          <section className="panel flex h-[720px] flex-col overflow-hidden">
            <TeamsSection fixes={all} teamOf={teamOf} onAssign={assign} teamFilter="" onTeamFilter={() => {}} onBird={(id) => router.push(`/aviary/map?bird=${id}`)} />
          </section>
        </div>
      </AviaryFrame>
    </div>
  );
}
