"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search, X } from "lucide-react";
import { AGE_LABEL, FIX_STATUS, LEVELS, MONITOR_ZONES, MONITOR_ZONE_BY_ID, type FixStatus, type LevelId } from "@/domain/aviaryTracking";
import { MONITOR_SPECIES, MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { MONITOR_TEAM_BY_ID } from "@/data/aviaryTeams";
import { useTeamAssignments } from "@/state/useTeams";
import { SpeciesAvatar } from "./SpeciesAvatar";
import { fmtHeight } from "@/logic/aviaryTracking";
import { fmtAgo, fmtDateTime } from "@/logic/time";
import { Select } from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/AppShell";
import { AviaryFrame, useAviarySnapshot } from "./common";

const PAGE = 100;

/** Every bird in one searchable table, as the penguin registry. A row opens its individual profile. */
export function BirdRegistry() {
  const { registry, fixes, asOf } = useAviarySnapshot();
  const { teamOf } = useTeamAssignments(registry);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [speciesId, setSpeciesId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [level, setLevel] = useState<LevelId | "">("");
  const [status, setStatus] = useState<FixStatus | "">("");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...fixes.values()].filter((f) => {
      const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
      if (speciesId && f.bird.speciesId !== speciesId) return false;
      if (zoneId && f.det?.zoneId !== zoneId) return false;
      if (level && f.levelId !== level) return false;
      if (status && f.status !== status) return false;
      if (!q) return true;
      return [f.bird.id, sp.common, sp.commonEs, sp.scientific, f.bird.name ?? ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [fixes, query, speciesId, zoneId, level, status]);

  const filtered = !!(query || speciesId || zoneId || level || status);

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Aviary · Registry" title="Individuals" subtitle={`${registry.birds.length} birds across ${registry.species.length} species. Open any of them to see its individual profile.`} />
      <AviaryFrame>
        <section className="panel p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">Search by ID, common or scientific name</span>
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => (setQuery(e.target.value), setLimit(PAGE))}
                placeholder="Search ID, common or scientific name…"
                className="h-9 w-full rounded-xl border border-line-strong bg-panel-solid pl-8 pr-3 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/60"
              />
            </label>
            <Select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)} aria-label="Species">
              <option value="">All species ({registry.species.length})</option>
              {MONITOR_SPECIES.map((s) => (
                <option key={s.id} value={s.id}>{s.code} · {s.common} ({s.demoCount})</option>
              ))}
            </Select>
            <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)} aria-label="Zone">
              <option value="">All zones</option>
              {MONITOR_ZONES.map((z) => (
                <option key={z.id} value={z.id}>{z.code} · {z.name}</option>
              ))}
            </Select>
            <Select value={level} onChange={(e) => setLevel(e.target.value as LevelId | "")} aria-label="Height level">
              <option value="">All levels</option>
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value as FixStatus | "")} aria-label="Status">
              <option value="">All statuses</option>
              {(Object.keys(FIX_STATUS) as FixStatus[]).map((s) => (
                <option key={s} value={s}>{FIX_STATUS[s].label}</option>
              ))}
            </Select>
            {filtered && (
              <button onClick={() => (setQuery(""), setSpeciesId(""), setZoneId(""), setLevel(""), setStatus(""))} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                <X size={12} /> Clear
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            <span className="num font-semibold text-ink">{rows.length}</span> of {registry.birds.length} birds
          </p>

          <div className="scroll-thin mt-2 overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <caption className="sr-only">Bird registry</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
                  <th className="px-3 py-2.5 font-medium">Bird</th>
                  <th className="px-3 py-2.5 font-medium">Species</th>
                  <th className="px-3 py-2.5 font-medium">Team</th>
                  <th className="px-3 py-2.5 font-medium">Last location</th>
                  <th className="px-3 py-2.5 font-medium">Last detection</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((f) => {
                  const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
                  const team = MONITOR_TEAM_BY_ID[teamOf(f.bird)];
                  const d = f.det;
                  const href = `/aviary/birds/${f.bird.id}`;
                  return (
                    <tr
                      key={f.bird.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => router.push(href)}
                      onKeyDown={(e) => e.key === "Enter" && router.push(href)}
                      className="cursor-pointer border-t border-line transition hover:bg-accent/[0.06] focus-visible:bg-accent/[0.08] focus-visible:outline-none"
                    >
                      <td className="px-3 py-2">
                        <Link href={href} className="flex items-center gap-2.5">
                          <SpeciesAvatar code={sp.code} size={30} ring={sp.color} />
                          <span>
                            <span className="block font-mono font-medium">{f.bird.id}</span>
                            <span className="block text-[11px] text-muted">{f.bird.name ?? `${AGE_LABEL[f.bird.ageClass]} · ${f.bird.ageYears.toFixed(1)} y`}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted">
                        <Link href={`/aviary/species/${sp.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-ink hover:underline">{sp.common}</Link>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-muted">
                          <span className="h-2 w-2 rounded-full" style={{ background: team.color }} />
                          {team.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted">
                        {d?.zoneId ? MONITOR_ZONE_BY_ID[d.zoneId].name : "—"}
                        <span className="block text-[10px] text-faint">{[d?.treeId, d?.pos ? fmtHeight(d.pos.y) : d?.kind === "zone" ? "zone only" : null].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="num px-3 py-2 text-xs text-muted" title={d ? fmtDateTime(d.at, asOf) : undefined}>
                        {d ? fmtAgo(d.at, asOf) : "Never"}
                        {d && <span className="block text-[10px] text-faint">{d.precisionM != null ? `± ${d.precisionM.toFixed(1)} m` : "zone level"} · {Math.round(d.confidence * 100)}%</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: FIX_STATUS[f.status].color }} />
                          {FIX_STATUS[f.status].label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link href={href} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                          Profile <ArrowUpRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > limit && (
            <button onClick={() => setLimit((n) => n + PAGE)} className="mt-3 w-full rounded-lg border border-line-strong py-2 text-xs text-muted hover:text-ink">
              Show {Math.min(PAGE, rows.length - limit)} more ({rows.length - limit} left)
            </button>
          )}
        </section>
      </AviaryFrame>
    </div>
  );
}
