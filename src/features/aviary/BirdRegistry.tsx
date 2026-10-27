"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Bird, Search } from "lucide-react";
import { AVIARY_SPECIES, AVIARY_SPECIES_BY_ID, AVIARY_TEAMS, AVIARY_TEAM_BY_ID, AVIARY_ZONES, AVIARY_ZONE_BY_ID, type AviarySpeciesId } from "@/domain/aviary";
import { AVIARY_HISTORY_DAYS } from "@/data/aviarySimulate";
import { birdRows, daysAgoLabel, fmtAvDateTime, matchBird, type BirdRow } from "@/logic/aviary";
import { useAviary } from "@/state/useAviary";
import { PageHeader } from "@/components/shell/AppShell";
import { Button, EmptyState, Select, cx } from "@/components/ui/primitives";
import { AviaryFrame, DemoTag, SpeciesDot } from "./common";

type SortKey = "id" | "name" | "species" | "seen";
const PAGE = 100;

export function BirdRegistry() {
  const { ds, speciesName } = useAviary();
  const params = useSearchParams();
  const router = useRouter();

  const [q, setQ] = useState("");
  const [species, setSpecies] = useState<AviarySpeciesId | "">(() => (AVIARY_SPECIES_BY_ID[params.get("species") as AviarySpeciesId] ? (params.get("species") as AviarySpeciesId) : ""));
  const [zone, setZone] = useState(() => (AVIARY_ZONE_BY_ID[params.get("zone") ?? ""] ? params.get("zone")! : ""));
  const [team, setTeam] = useState(() => (AVIARY_TEAM_BY_ID[params.get("team") ?? ""] ? params.get("team")! : ""));
  const [stale, setStale] = useState(() => {
    const n = Number(params.get("stale"));
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>(() => (params.get("stale") ? { key: "seen", dir: -1 } : { key: "id", dir: 1 }));
  const [shown, setShown] = useState(PAGE);

  const all = useMemo(() => birdRows(ds, ds.birds), [ds]);
  const rows = useMemo(() => {
    const list = all.filter(
      (r) =>
        (!species || r.bird.speciesId === species) &&
        (!team || r.bird.teamId === team) &&
        (!zone || r.last?.zoneId === zone) &&
        (!stale || r.days === null || r.days >= stale) &&
        matchBird(r.bird, speciesName(r.bird), q),
    );
    const seen = (r: BirdRow) => r.last?.at ?? -Infinity;
    const cmp: Record<SortKey, (a: BirdRow, b: BirdRow) => number> = {
      id: (a, b) => a.bird.id.localeCompare(b.bird.id),
      name: (a, b) => (a.bird.name ?? "~").localeCompare(b.bird.name ?? "~") || a.bird.id.localeCompare(b.bird.id),
      species: (a, b) => speciesName(a.bird).localeCompare(speciesName(b.bird)) || a.bird.id.localeCompare(b.bird.id),
      // Ascending = most recently seen first.
      seen: (a, b) => seen(b) - seen(a) || a.bird.id.localeCompare(b.bird.id),
    };
    return [...list].sort((a, b) => cmp[sort.key](a, b) * sort.dir);
  }, [all, species, team, zone, stale, q, sort, speciesName]);

  const filtered = Boolean(q || species || zone || team || stale);
  const clear = () => {
    setQ("");
    setSpecies("");
    setZone("");
    setTeam("");
    setStale(0);
    setShown(PAGE);
  };
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setShown(PAGE);
  };

  return (
    <div className="pb-10">
      <PageHeader eyebrow="Aviary · Registry" title="Bird registry" subtitle="Search the demo roster by ID, band, name or species. Open any bird to see its sighting history." />
      <AviaryFrame banner="IDs, names and bands are placeholders. The identification method SeaWorld uses (bands, rings, transponders or none) is still to be confirmed.">
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line-strong bg-panel-solid px-3">
              <Search size={14} className="text-muted" aria-hidden />
              <span className="sr-only">Search birds</span>
              <input
                value={q}
                onChange={(e) => resetPage(setQ)(e.target.value)}
                placeholder="Search by ID, band, name or species"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
              />
            </label>
            <Select value={species} onChange={(e) => resetPage(setSpecies)(e.target.value as AviarySpeciesId | "")} aria-label="Species group">
              <option value="">All species groups</option>
              {AVIARY_SPECIES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Select value={zone} onChange={(e) => resetPage(setZone)(e.target.value)} aria-label="Last logged zone">
              <option value="">All zones (last sighting)</option>
              {AVIARY_ZONES.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </Select>
            <Select value={team} onChange={(e) => resetPage(setTeam)(e.target.value)} aria-label="Responsible team">
              <option value="">All teams</option>
              {AVIARY_TEAMS.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
            <Select value={String(stale)} onChange={(e) => resetPage(setStale)(Number(e.target.value))} aria-label="Days since last sighting">
              <option value="0">Any last sighting</option>
              {[2, 3, 5, 7].map((n) => (
                <option key={n} value={n}>Not observed ≥{n} days</option>
              ))}
            </Select>
            <span className="num ml-auto text-xs text-muted">
              {rows.length} of {all.length} birds <DemoTag className="ml-1" />
            </span>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={Bird}
              title="No birds match these filters"
              action={<Button variant="outline" size="sm" onClick={clear}>Clear filters</Button>}
            >
              Try a different search or remove a filter. Zone filters use each bird&apos;s last logged sighting only.
            </EmptyState>
          ) : (
            <>
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <caption className="sr-only">Demo bird registry</caption>
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
                      <Th label="Bird" k="id" sort={sort} onSort={toggleSort} />
                      <Th label="Name" k="name" sort={sort} onSort={toggleSort} />
                      <Th label="Species group" k="species" sort={sort} onSort={toggleSort} />
                      <th scope="col" className="px-4 py-2.5 font-medium">Band</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Team</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Last logged zone</th>
                      <Th label="Last seen" k="seen" sort={sort} onSort={toggleSort} />
                      <th scope="col"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, shown).map(({ bird, last, days }) => {
                      const t = AVIARY_TEAM_BY_ID[bird.teamId];
                      const href = `/aviary/birds/${bird.id}`;
                      return (
                        <tr
                          key={bird.id}
                          onClick={() => router.push(href)}
                          className="cursor-pointer border-t border-line transition hover:bg-accent/[0.06]"
                        >
                          <td className="px-4 py-2">
                            <Link href={href} className="inline-flex items-center gap-2 font-mono font-medium hover:underline">
                              <SpeciesDot id={bird.speciesId} />
                              {bird.id}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-muted">{bird.name ?? <span className="text-faint">—</span>}</td>
                          <td className="px-4 py-2 text-muted">{speciesName(bird)}</td>
                          <td className="px-4 py-2 font-mono text-xs text-muted">{bird.bandId}</td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center gap-1.5 text-muted">
                              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} aria-hidden />
                              {t.name}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-muted">{last ? AVIARY_ZONE_BY_ID[last.zoneId].name : "—"}</td>
                          <td className="num px-4 py-2 text-xs">
                            <span className={cx(days === null || days >= 3 ? "text-warn" : "text-muted")}>{daysAgoLabel(days, AVIARY_HISTORY_DAYS)}</span>
                            {last && <span className="block text-[10px] text-faint">{fmtAvDateTime(last.at)}</span>}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Link href={href} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-accent hover:underline" aria-label={`Open profile of ${bird.id}`}>
                              Profile <ArrowUpRight size={12} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-muted">
                <span>
                  Showing {Math.min(shown, rows.length)} of {rows.length}. &ldquo;Last seen&rdquo; is the last manual keeper sighting, not a live location.
                </span>
                {rows.length > shown && (
                  <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                    Show more
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
        {filtered && rows.length > 0 && (
          <button className="text-xs text-accent hover:underline" onClick={clear}>Clear all filters</button>
        )}
      </AviaryFrame>
    </div>
  );
}

function Th({ label, k, sort, onSort }: { label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void }) {
  const active = sort.key === k;
  return (
    <th scope="col" className="px-4 py-2.5 font-medium" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={() => onSort(k)} className={cx("inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink", active && "text-ink")}>
        {label}
        {active && (sort.dir === 1 ? <ArrowUp size={11} aria-hidden /> : <ArrowDown size={11} aria-hidden />)}
      </button>
    </th>
  );
}
