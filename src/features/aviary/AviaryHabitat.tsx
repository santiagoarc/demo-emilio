"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowUpRight, Info, MapPinned, Radar, X } from "lucide-react";
import { AVIARY_SPECIES, AVIARY_TEAMS, AVIARY_ZONES, AVIARY_ZONE_BY_ID, type AviarySpeciesId, type AviaryZone } from "@/domain/aviary";
import { AVIARY_HISTORY_DAYS } from "@/data/aviarySimulate";
import { birdRows, daysAgoLabel } from "@/logic/aviary";
import { useAviary } from "@/state/useAviary";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, Card, Chip, EmptyState, cx } from "@/components/ui/primitives";
import { hideTip, showTip } from "@/components/charts/Charts";
import { AviaryFrame, DemoTag, SpeciesDot } from "./common";

const W = 1600;
const H = 1000;
const LIST_CAP = 60;

const centroid = (pts: [number, number][]) => {
  const n = pts.length;
  return [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n] as const;
};

/** Sequential teal ramp: lighter = fewer birds. */
const fillFor = (count: number, max: number) => (count === 0 ? "rgba(11,36,64,0.04)" : `rgba(14,159,149,${(0.12 + 0.68 * (count / max)).toFixed(3)})`);

export function AviaryHabitat() {
  const { ds, speciesName } = useAviary();
  const params = useSearchParams();
  const [species, setSpecies] = useState<AviarySpeciesId[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(() => (AVIARY_ZONE_BY_ID[params.get("zone") ?? ""] ? params.get("zone") : null));
  const [future, setFuture] = useState(false);

  const rows = useMemo(
    () => birdRows(ds, ds.birds).filter((r) => (!species.length || species.includes(r.bird.speciesId)) && (!teams.length || teams.includes(r.bird.teamId))),
    [ds, species, teams],
  );
  const byZone = useMemo(() => {
    const m = new Map<string, typeof rows>(AVIARY_ZONES.map((z) => [z.id, []]));
    for (const r of rows) if (r.last) m.get(r.last.zoneId)!.push(r);
    return m;
  }, [rows]);
  const unseen = rows.filter((r) => !r.last).length;
  const max = Math.max(1, ...[...byZone.values()].map((l) => l.length));

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const zone = selected ? AVIARY_ZONE_BY_ID[selected] : null;
  const zoneRows = zone ? [...(byZone.get(zone.id) ?? [])].sort((a, b) => a.bird.id.localeCompare(b.bird.id)) : [];
  const zoneTeams = zone ? AVIARY_TEAMS.filter((t) => t.zoneIds.includes(zone.id)) : [];

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Aviary · Habitat"
        title="Habitat plan"
        subtitle="Birds per zone, from each bird's last logged keeper sighting. Select a zone to see who was logged there."
      />
      <AviaryFrame banner="Illustrative layout — not a survey of the real aviary. Locations are last logged keeper sightings, not live positions.">
        <div className="panel-flat flex flex-wrap items-center gap-2 p-4">
          <span className="mr-1 text-xs text-muted">Species</span>
          {AVIARY_SPECIES.map((s) => (
            <Chip key={s.id} color={s.color} active={species.includes(s.id)} onClick={() => setSpecies((l) => toggle(l, s.id))}>
              {s.name}
            </Chip>
          ))}
          <span className="ml-3 mr-1 text-xs text-muted">Team</span>
          {AVIARY_TEAMS.map((t) => (
            <Chip key={t.id} color={t.color} active={teams.includes(t.id)} onClick={() => setTeams((l) => toggle(l, t.id))}>
              {t.name}
            </Chip>
          ))}
          {(species.length > 0 || teams.length > 0) && (
            <button className="ml-1 text-xs text-accent hover:underline" onClick={() => (setSpecies([]), setTeams([]))}>Clear</button>
          )}
          <button
            role="switch"
            aria-checked={future}
            onClick={() => setFuture((v) => !v)}
            className={cx(
              "ml-auto inline-flex h-8 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition",
              future ? "border-accent-2/50 bg-accent-2/10 text-ink" : "border-line-strong text-muted hover:text-ink",
            )}
          >
            <Radar size={13} aria-hidden />
            Future integration preview
            <span className={cx("relative h-4 w-7 rounded-full transition", future ? "bg-accent-2" : "bg-ink/15")} aria-hidden>
              <span className={cx("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", future ? "left-3.5" : "left-0.5")} />
            </span>
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card
            title="Aviary plan · birds by last logged zone"
            subtitle={`${rows.length} demo birds in view${unseen ? ` · ${unseen} with no sighting in ${AVIARY_HISTORY_DAYS} days (not on the plan)` : ""}`}
            icon={MapPinned}
            action={<DemoTag>Illustrative</DemoTag>}
          >
            <div className="relative">
              <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-xl bg-panel-2" role="group" aria-label="Illustrative aviary plan with zones colored by bird count at last sighting">
                <title>Illustrative aviary plan</title>
                <defs>
                  <pattern id="av-hatch" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="16" stroke="rgba(11,36,64,0.10)" strokeWidth="5" />
                  </pattern>
                </defs>
                <rect x="20" y="20" width={W - 40} height={H - 40} rx="28" fill="none" stroke="rgba(11,36,64,0.18)" strokeDasharray="10 8" strokeWidth="3" />
                {AVIARY_ZONES.map((z) => (
                  <ZoneShape
                    key={z.id}
                    zone={z}
                    count={byZone.get(z.id)?.length ?? 0}
                    max={max}
                    selected={selected === z.id}
                    onSelect={() => setSelected((s) => (s === z.id ? null : z.id))}
                  />
                ))}
                {future && (
                  <g aria-hidden pointerEvents="none">
                    <rect x="40" y="40" width={W - 80} height={H - 80} rx="24" fill="rgba(43,127,208,0.05)" stroke="#2b7fd0" strokeWidth="4" strokeDasharray="18 12" />
                    <text x={W / 2} y={H - 60} textAnchor="middle" fontSize="30" fill="#2b7fd0" fontWeight={600}>
                      Future integration preview · no live data shown
                    </text>
                  </g>
                )}
              </svg>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
              <span className="inline-flex items-center gap-2">
                Fewer
                <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg, rgba(14,159,149,0.12), rgba(14,159,149,0.8))" }} aria-hidden />
                More birds
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-[3px] border border-line-strong" style={{ background: "repeating-linear-gradient(45deg, rgba(11,36,64,0.12) 0 3px, transparent 3px 7px)" }} aria-hidden />
                Off exhibit
              </span>
              <span>Click a zone, or focus it and press Enter.</span>
            </div>
          </Card>

          <div className="flex min-w-0 flex-col gap-5">
            {future && (
              <Card title="Future integration preview" icon={Radar} action={<Badge tone="info">Concept only</Badge>}>
                <p className="text-sm text-muted">
                  Showing where birds are in real time would require validated identification and tracking hardware suited to birds, installed and tested
                  in the aviary. Nothing like that is assumed here.
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
                  <li>Birds are not assumed to carry chips or tags.</li>
                  <li>No live positions are drawn on the plan, in this preview or elsewhere.</li>
                  <li>Any future feed would need SeaWorld&apos;s veterinary and animal-welfare approval first.</li>
                </ul>
              </Card>
            )}

            <Card
              title={zone ? zone.name : "Zone details"}
              subtitle={zone ? zone.description : "Select a zone on the plan"}
              icon={Info}
              action={
                zone && (
                  <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close zone details">
                    <X size={14} />
                  </button>
                )
              }
            >
              {!zone ? (
                <EmptyState icon={MapPinned} title="No zone selected">
                  Select a zone to list the birds whose last logged sighting was there, and the team that covers it.
                </EmptyState>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-2xl font-semibold">{zoneRows.length}</span>
                    <span className="text-xs text-muted">birds last logged here</span>
                    <DemoTag />
                    {zone.offExhibit && <Badge tone="warn">Off exhibit</Badge>}
                  </div>
                  <p className="mt-3 text-[11px] uppercase tracking-wider text-faint">Responsible team</p>
                  {zoneTeams.length === 0 ? (
                    <p className="text-sm text-muted">No team assigned.</p>
                  ) : (
                    zoneTeams.map((t) => (
                      <p key={t.id} className="mt-1 flex items-center gap-2 text-sm">
                        <span className="h-2 w-2 rounded-full" style={{ background: t.color }} aria-hidden />
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-muted">· lead {t.lead}</span>
                      </p>
                    ))
                  )}
                  <p className="mt-4 text-[11px] uppercase tracking-wider text-faint">Birds</p>
                  {zoneRows.length === 0 ? (
                    <p className="mt-1 text-sm text-muted">No bird in the current filters was last logged here.</p>
                  ) : (
                    <ul className="scroll-thin mt-1 max-h-[360px] divide-y divide-line overflow-y-auto">
                      {zoneRows.slice(0, LIST_CAP).map(({ bird, days }) => (
                        <li key={bird.id}>
                          <Link href={`/aviary/birds/${bird.id}`} className="flex items-center gap-2.5 py-1.5 text-sm hover:bg-ink/[0.02]">
                            <SpeciesDot id={bird.speciesId} />
                            <span className="min-w-0 flex-1 truncate">
                              <span className="font-mono">{bird.id}</span>
                              <span className="ml-1.5 text-xs text-muted">{speciesName(bird)}</span>
                            </span>
                            <span className="num whitespace-nowrap text-[11px] text-faint">{daysAgoLabel(days, AVIARY_HISTORY_DAYS)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {zoneRows.length > LIST_CAP && (
                    <Link href={`/aviary/birds?zone=${zone.id}`} className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                      See all {zoneRows.length} in the registry <ArrowUpRight size={12} />
                    </Link>
                  )}
                  <p className="mt-3 text-[11px] text-faint">Teams per zone are fictional. Birds may have moved since they were logged.</p>
                </>
              )}
            </Card>
          </div>
        </div>
      </AviaryFrame>
    </div>
  );
}

function ZoneShape({ zone, count, max, selected, onSelect }: { zone: AviaryZone; count: number; max: number; selected: boolean; onSelect: () => void }) {
  const [cx0, cy0] = centroid(zone.polygon);
  const points = zone.polygon.map((p) => p.join(",")).join(" ");
  const team = AVIARY_TEAMS.find((t) => t.zoneIds.includes(zone.id));
  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${zone.name}${zone.offExhibit ? ", off exhibit" : ""}: ${count} birds at last logged sighting. Show details.`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onMouseMove={(e) =>
        showTip(e, {
          title: zone.name,
          rows: [{ label: "Birds at last sighting", value: count }, ...(team ? [{ color: team.color, label: "Team", value: team.name }] : [])],
          note: "Demo data · manual keeper sightings",
        })
      }
      onMouseLeave={hideTip}
      className="cursor-pointer outline-none [&:focus-visible>polygon]:stroke-[#2b7fd0]"
    >
      <polygon points={points} fill={fillFor(count, max)} stroke={selected ? "#0b2440" : "rgba(11,36,64,0.28)"} strokeWidth={selected ? 6 : 2.5} strokeLinejoin="round" />
      {zone.offExhibit && <polygon points={points} fill="url(#av-hatch)" pointerEvents="none" />}
      <text x={cx0} y={cy0 - 8} textAnchor="middle" fontSize="30" fontWeight={600} fill="#0b2440" pointerEvents="none">
        {zone.name}
      </text>
      <text x={cx0} y={cy0 + 34} textAnchor="middle" fontSize="34" fill="#0b2440" className="num" pointerEvents="none">
        {count}
        <tspan fontSize="22" fill="#5a7189"> birds</tspan>
      </text>
    </g>
  );
}
