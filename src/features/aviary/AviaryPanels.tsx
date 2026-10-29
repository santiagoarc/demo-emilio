"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, Lock, Search, Unlock, Users, X } from "lucide-react";
import { FIX_STATUS, MONITOR_ZONE_BY_ID, type MonitorBird, type MonitorSpecies } from "@/domain/aviaryTracking";
import { MONITOR_SPECIES, MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { MONITOR_TEAMS, type TeamId } from "@/data/aviaryTeams";
import type { Fix } from "@/logic/aviaryTracking";
import { cx } from "@/components/ui/primitives";
import { SpeciesAvatar } from "./SpeciesAvatar";

/**
 * Species list and monitoring teams, shared by the Habitat map and the Teams page.
 */

/* ---------- left panel: species ---------- */

/** One legend row height on the map. */
const SPECIES_ROW = 38;

/** Discreet monitoring status for a group of birds: worst state wins. */
export function monitorState(fixes: Fix[]) {
  const noSignal = fixes.filter((f) => f.status === "no-signal").length;
  const stale = fixes.filter((f) => f.status === "stale").length;
  const detected = fixes.length - noSignal - stale;
  if (noSignal) return { color: FIX_STATUS["no-signal"].color, label: `${noSignal} without signal`, detected, noSignal };
  if (stale) return { color: FIX_STATUS.stale.color, label: `${stale} with an old location`, detected, noSignal };
  return { color: FIX_STATUS.detected.color, label: "All detected", detected, noSignal };
}

export function lastPlace(f: Fix) {
  const d = f.det;
  if (!d) return "No location";
  const zone = d.zoneId ? MONITOR_ZONE_BY_ID[d.zoneId].code : "—";
  return [zone, d.treeId, d.pos ? `${d.pos.y.toFixed(1)} m` : d.kind === "zone" ? "zone only" : null].filter(Boolean).join(" · ");
}

/**
 * One species in a list: photo, common name, number of birds and a discreet
 * monitoring dot. The scientific name stays as a small second line.
 */
export function SpeciesRow({ species: s, birds, selected, onClick, size = "sm", title }: {
  species: MonitorSpecies;
  birds: Fix[];
  selected: boolean;
  onClick: () => void;
  size?: "sm" | "lg";
  title?: string;
}) {
  const st = monitorState(birds);
  const lg = size === "lg";
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      title={title}
      className={cx(
        "group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left transition",
        selected ? "bg-accent/12 ring-1 ring-accent/40" : "hover:bg-ink/[0.045] hover:shadow-[0_2px_8px_rgba(11,36,64,0.08)]",
      )}
      style={{ minHeight: lg ? 52 : SPECIES_ROW }}
    >
      <SpeciesAvatar code={s.code} size={lg ? 36 : 26} ring={s.color} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className={cx("block truncate font-medium text-ink", lg ? "text-[13px]" : "text-[12px]")}>{s.common}</span>
        {lg && <span className="block truncate text-[10.5px] italic text-faint">{s.scientific}</span>}
      </span>
      <span className={cx("num font-semibold text-ink", lg ? "text-[13px]" : "text-[12px]")}>{birds.length}</span>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: st.color }} title={st.label} aria-label={st.label} />
    </button>
  );
}

export function SpeciesSection({ fixes, speciesFilter, onSpeciesFilter, onBird, selectedBird }: {
  fixes: Fix[];
  speciesFilter: string;
  onSpeciesFilter: (id: string) => void;
  onBird: (id: string) => void;
  selectedBird: string | null;
}) {
  const [q, setQ] = useState("");
  const bySpecies = useMemo(() => {
    const m = new Map<string, Fix[]>();
    for (const f of fixes) {
      const list = m.get(f.bird.speciesId);
      if (list) list.push(f);
      else m.set(f.bird.speciesId, [f]);
    }
    return m;
  }, [fixes]);
  const t = q.trim().toLowerCase();
  const list = MONITOR_SPECIES.filter((s) => !t || `${s.common} ${s.commonEs} ${s.scientific}`.toLowerCase().includes(t));

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Species">
      <div className="border-b border-line px-3 pb-2.5 pt-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-ink">Species legend</h2>
          {speciesFilter ? (
            <button onClick={() => onSpeciesFilter("")} className="text-[11px] font-medium text-accent hover:underline">
              Show all
            </button>
          ) : (
            <span className="text-[11px] text-muted">
              {MONITOR_SPECIES.length} · {fixes.length} birds
            </span>
          )}
        </div>
        <label className="relative mt-2 block">
          <span className="sr-only">Search a species by name</span>
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a species…"
            className="h-9 w-full rounded-xl border border-line-strong bg-panel-solid pl-8 pr-7 text-xs text-ink outline-none placeholder:text-faint focus:border-accent/60"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink" aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </label>
      </div>
      <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">
        {list.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted">No species matches “{q}”.</li>}
        {list.map((s) => {
          const birds = bySpecies.get(s.id) ?? [];
          const st = monitorState(birds);
          const on = speciesFilter === s.id;
          return (
            <li key={s.id}>
              <SpeciesRow species={s} birds={birds} selected={on} onClick={() => onSpeciesFilter(on ? "" : s.id)} title={on ? "Click again to show all species" : `Show only ${s.common} on the map`} />
              {on && (
                <div className="mx-1 mb-2 mt-1 rounded-lg border border-line bg-panel-2/60 p-2">
                  <p className="text-[11px] text-muted">
                    <i>{s.scientific}</i> · {st.detected}/{birds.length} detected · <Link href={`/aviary/species/${s.id}`} className="text-accent hover:underline">species page →</Link>
                  </p>
                  <ul className="scroll-thin mt-1.5 max-h-56 overflow-y-auto">
                    {birds.map((f) => (
                      <li key={f.bird.id}>
                        <button
                          onClick={() => onBird(f.bird.id)}
                          className={cx("flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left", selectedBird === f.bird.id ? "bg-accent/15" : "hover:bg-ink/[0.04]")}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: FIX_STATUS[f.status].color }} title={FIX_STATUS[f.status].label} />
                          <span className="font-mono text-[11px] font-semibold text-ink">{f.bird.id}</span>
                          <span className="ml-auto truncate text-[10px] text-muted">{lastPlace(f)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- right panel: monitoring teams ---------- */

export function TeamsSection({ fixes, teamOf, onAssign, teamFilter, onTeamFilter, onBird }: {
  fixes: Fix[];
  teamOf: (bird: MonitorBird) => TeamId;
  onAssign: (bird: MonitorBird, team: TeamId) => void;
  teamFilter: TeamId | "";
  onTeamFilter: (t: TeamId | "") => void;
  onBird: (id: string) => void;
}) {
  const [open, setOpen] = useState<TeamId | null>(null);
  const [q, setQ] = useState("");
  // Demo permission: the signed-in demo user may reassign birds once editing is switched on.
  const [editing, setEditing] = useState(false);
  const byTeam = useMemo(() => {
    const m = new Map<TeamId, Fix[]>(MONITOR_TEAMS.map((t) => [t.id, []]));
    for (const f of fixes) m.get(teamOf(f.bird))!.push(f);
    return m;
  }, [fixes, teamOf]);
  const total = fixes.length;
  const assigned = [...byTeam.values()].reduce((a, l) => a + l.length, 0);

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Care teams">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 pb-2.5 pt-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Users size={15} className="text-accent" /> Care teams
          </h2>
          <p className="text-[11px] text-muted" title="Each bird belongs to exactly one team">
            {MONITOR_TEAMS.length} teams · {assigned}/{total} birds assigned
          </p>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className={cx("inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium", editing ? "border-accent bg-accent/12 text-ink" : "border-line-strong text-muted hover:text-ink")}
          title="The signed-in user can reassign birds"
          aria-pressed={editing}
        >
          {editing ? <Unlock size={12} /> : <Lock size={12} />} {editing ? "Editing" : "Edit"}
        </button>
      </div>
      <ul className="scroll-thin min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {MONITOR_TEAMS.map((team) => {
          const birds = byTeam.get(team.id)!;
          const st = monitorState(birds);
          const speciesIds = [...new Set(birds.map((f) => f.bird.speciesId))];
          const expanded = open === team.id;
          const t = q.trim().toLowerCase();
          const shown = expanded && t ? birds.filter((f) => `${f.bird.id} ${MONITOR_SPECIES_BY_ID[f.bird.speciesId].common} ${MONITOR_SPECIES_BY_ID[f.bird.speciesId].scientific}`.toLowerCase().includes(t)) : birds;
          return (
            <li
              key={team.id}
              className={cx("relative overflow-hidden rounded-xl border", expanded ? "bg-panel-2/40" : "border-line", teamFilter === team.id && !expanded && "bg-ink/[0.02]")}
              style={expanded || teamFilter === team.id ? { borderColor: `${team.color}88` } : undefined}
            >
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: team.color }} aria-hidden />
              <button onClick={() => (setOpen(expanded ? null : team.id), setQ(""))} aria-expanded={expanded} className="flex w-full items-center gap-2.5 py-2 pl-3.5 pr-2.5 text-left">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold" style={{ background: `${team.color}22`, color: team.color }}>{team.name.split(" ")[1][0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink">{team.name}</span>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} title={st.label} />
                  </span>
                  <span className="num block truncate text-[11px] text-muted">
                    {birds.length} birds · {speciesIds.length} species · {st.detected} detected · {st.noSignal} no signal
                  </span>
                </span>
                <span className="hidden -space-x-1.5 2xl:flex">
                  {speciesIds.slice(0, 3).map((sid) => (
                    <SpeciesAvatar key={sid} code={MONITOR_SPECIES_BY_ID[sid].code} size={20} />
                  ))}
                </span>
                <ChevronDown size={14} className={cx("shrink-0 text-faint transition", expanded && "rotate-180")} />
              </button>
              {expanded && (
                <div className="border-t border-line px-2 pb-2 pt-2">
                  <div className="flex items-center gap-1.5">
                    <label className="relative flex-1">
                      <span className="sr-only">Search this team by ID or species</span>
                      <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-faint" />
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="ID or species…"
                        className="h-7 w-full rounded-lg border border-line-strong bg-panel-solid pl-6 pr-2 text-[11px] text-ink outline-none placeholder:text-faint focus:border-accent/60"
                      />
                    </label>
                    <button
                      onClick={() => onTeamFilter(teamFilter === team.id ? "" : team.id)}
                      className={cx("h-7 shrink-0 rounded-lg border px-2 text-[10px] font-medium", teamFilter === team.id ? "text-white" : "border-line-strong text-ink hover:border-accent/50")}
                      style={teamFilter === team.id ? { background: team.color, borderColor: team.color } : undefined}
                    >
                      {teamFilter === team.id ? "On map ✓" : "Show on map"}
                    </button>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 px-1 text-[10px] text-faint">
                    <span className="h-2 w-2 rounded-full" style={{ background: team.color }} />
                    Lead {team.lead} · {shown.length} of {birds.length}
                  </p>
                  <ul className="scroll-thin mt-1 max-h-72 overflow-y-auto">
                    {shown.map((f) => {
                      const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
                      return (
                        <li key={f.bird.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-ink/[0.04]">
                          <button onClick={() => onBird(f.bird.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                            <SpeciesAvatar code={sp.code} size={24} ring={FIX_STATUS[f.status].color} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline gap-1.5">
                                <span className="font-mono text-[11px] font-semibold text-ink">{f.bird.id}</span>
                                <span className="truncate text-[10px] text-muted">{sp.common}</span>
                              </span>
                              <span className="block truncate text-[10px] text-faint">{lastPlace(f)}</span>
                            </span>
                          </button>
                          {editing && (
                            <select
                              value={team.id}
                              onChange={(e) => onAssign(f.bird, e.target.value as TeamId)}
                              aria-label={`Team for ${f.bird.id}`}
                              className="h-6 rounded-md border border-line-strong bg-panel-solid px-1 text-[10px] text-ink"
                            >
                              {MONITOR_TEAMS.map((tm) => (
                                <option key={tm.id} value={tm.id}>
                                  {tm.name.replace("Team ", "")}
                                </option>
                              ))}
                            </select>
                          )}
                        </li>
                      );
                    })}
                    {shown.length === 0 && <li className="px-2 py-3 text-center text-[11px] text-muted">No bird in this team matches.</li>}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
