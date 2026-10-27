"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Bird, CalendarClock, Layers, MapPinned, NotebookPen, Users } from "lucide-react";
import { AVIARY_ESTIMATE, AVIARY_SPECIES, AVIARY_SPECIES_BY_ID, AVIARY_TEAMS, AVIARY_TEAM_BY_ID, AVIARY_ZONES, AVIARY_ZONE_BY_ID } from "@/domain/aviary";
import { AVIARY_HISTORY_DAYS } from "@/data/aviarySimulate";
import { birdsByLastZone, birdsBySpecies, birdsByTeam, daysAgoLabel, fmtAvDay, fmtAvDayLong, notObservedFor, sightingsPerDay } from "@/logic/aviary";
import { useAviary } from "@/state/useAviary";
import { PageHeader } from "@/components/shell/AppShell";
import { Button, Card, EmptyState } from "@/components/ui/primitives";
import { BarList, StackedColumns } from "@/components/charts/Charts";
import { AviaryFrame, DemoTag, SpeciesDot } from "./common";

const STALE_DAYS = 3;
const PAGE = 10;

export function AviaryOverview() {
  const { ds } = useAviary();
  const [shown, setShown] = useState(PAGE);
  const birds = ds.birds;

  const bySpecies = useMemo(() => birdsBySpecies(birds), [birds]);
  const byZone = useMemo(() => birdsByLastZone(ds, birds), [ds, birds]);
  const byTeam = useMemo(() => birdsByTeam(birds, AVIARY_TEAMS.map((t) => t.id)), [birds]);
  const perDay = useMemo(() => sightingsPerDay(ds, birds), [ds, birds]);
  const stale = useMemo(() => notObservedFor(ds, birds, STALE_DAYS), [ds, birds]);

  const mentioned = AVIARY_SPECIES.filter((s) => s.presence === "publicly-mentioned").length;
  const notProvided = AVIARY_SPECIES.filter((s) => s.presence === "not-provided").length;
  const totalSightings = perDay.reduce((a, d) => a + d.sightings, 0);

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Aviary · SeaWorld Abu Dhabi concept"
        title="Aviary"
        subtitle="How a bird roster and the keepers' sighting logbook could look in one place. Every figure below comes from demo data."
      />
      <AviaryFrame banner={`The ${birds.length}-bird roster stands in for the meeting estimate (${AVIARY_ESTIMATE.label}). Species split, IDs, bands and sightings are fictional.`}>
        <div className="panel grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
          <Kpi icon={Bird} color="#2b7fd0" value={birds.length} label="Registered birds" tag={<DemoTag>Demo roster</DemoTag>} hint="Simulated records" />
          <Kpi icon={Bird} color="#c7850c" value={AVIARY_ESTIMATE.label} label="Birds in the aviary" tag={<DemoTag>Estimate</DemoTag>} hint="From the meeting · to be confirmed" />
          <Kpi icon={Layers} color="#0e9f95" value={AVIARY_SPECIES.length} label="Species groups" hint={`${mentioned} publicly mentioned · ${notProvided} not provided`} />
          <Kpi
            icon={CalendarClock}
            color="#dc4a4a"
            value={stale.length}
            label={`Not observed in ≥${STALE_DAYS} days`}
            tag={<DemoTag />}
            hint={`Of ${birds.length} demo birds, by last logbook entry`}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="By species group" subtitle="Demo split of the roster — not a head count" icon={Layers} action={<DemoTag />}>
            <BarList
              items={bySpecies.map(({ species, count }) => ({
                key: species.id,
                label: species.name,
                value: count,
                color: species.color,
                hint: species.presence === "not-provided" ? "group not provided" : undefined,
              }))}
              format={(v) => `${v} birds`}
            />
            <p className="mt-4 text-[11px] text-faint">Real counts per species: to be confirmed by SeaWorld.</p>
          </Card>

          <Card title="By zone" subtitle="Zone of each bird's last logged sighting" icon={MapPinned} action={<DemoTag />}>
            <BarList
              items={AVIARY_ZONES.map((z) => ({
                key: z.id,
                label: z.offExhibit ? `${z.name} (off exhibit)` : z.name,
                value: byZone.counts.get(z.id) ?? 0,
                color: z.offExhibit ? "#8ca1b5" : "var(--accent)",
              }))}
              format={(v) => `${v} birds`}
            />
            <p className="mt-4 text-[11px] text-faint">
              Manual keeper sightings, not live positions.{byZone.unseen > 0 && ` ${byZone.unseen} birds have no sighting in the last ${AVIARY_HISTORY_DAYS} days.`}{" "}
              <Link href="/aviary/habitat" className="text-accent hover:underline">Open habitat plan</Link>
            </p>
          </Card>

          <Card title="By responsible team" subtitle="Fictional teams and people" icon={Users} action={<DemoTag />}>
            <BarList
              items={byTeam.map(({ teamId, count }) => ({
                key: teamId,
                label: AVIARY_TEAM_BY_ID[teamId].name,
                value: count,
                color: AVIARY_TEAM_BY_ID[teamId].color,
                hint: `lead ${AVIARY_TEAM_BY_ID[teamId].lead}`,
              }))}
              format={(v) => `${v} birds`}
            />
            <p className="mt-4 text-[11px] text-faint">Real team structure and zone ownership: to be confirmed.</p>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-5">
          <Card
            className="xl:col-span-3"
            title="Keeper logbook activity"
            subtitle={`Sightings logged per day · last ${AVIARY_HISTORY_DAYS} days · ${totalSightings.toLocaleString("en-GB")} entries`}
            icon={NotebookPen}
            action={<DemoTag />}
          >
            <div role="img" aria-label={`Bar chart of keeper logbook sightings per day over the last ${AVIARY_HISTORY_DAYS} days`}>
              <StackedColumns
                height={170}
                labelEvery={2}
                data={perDay.map((d) => ({
                  label: fmtAvDay(d.day),
                  tooltip: `${fmtAvDayLong(d.day)} · ${d.birds} birds logged`,
                  values: { sightings: d.sightings },
                }))}
                series={[{ key: "sightings", color: "#2b7fd0", label: "Sightings logged" }]}
                highlight={perDay.length - 1}
              />
            </div>
            <p className="mt-3 text-[11px] text-faint">
              This measures how much the logbook was used, not how active the birds were. Today is a partial day.
            </p>
          </Card>

          <Card
            className="xl:col-span-2"
            title={`Not observed in ≥${STALE_DAYS} days`}
            subtitle="Ordered by days since the last logbook entry"
            icon={CalendarClock}
            action={
              <Link href={`/aviary/birds?stale=${STALE_DAYS}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-accent hover:underline">
                Registry <ArrowUpRight size={12} />
              </Link>
            }
          >
            {stale.length === 0 ? (
              <EmptyState icon={Bird} title="Every bird was logged recently">
                No demo bird has gone {STALE_DAYS} days or more without a sighting.
              </EmptyState>
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {stale.slice(0, shown).map(({ bird, last, days }) => (
                    <li key={bird.id}>
                      <Link href={`/aviary/birds/${bird.id}`} className="flex items-center gap-3 py-2 text-sm transition hover:bg-ink/[0.02]">
                        <SpeciesDot id={bird.speciesId} />
                        <span className="min-w-0 flex-1">
                          <span className="font-mono font-medium">{bird.id}</span>
                          {bird.name && <span className="ml-1.5 text-muted">{bird.name}</span>}
                          <span className="block truncate text-[11px] text-muted">
                            {AVIARY_SPECIES_BY_ID[bird.speciesId].name} · {last ? AVIARY_ZONE_BY_ID[last.zoneId].name : "No zone logged"}
                          </span>
                        </span>
                        <span className="num whitespace-nowrap text-xs text-warn">{daysAgoLabel(days, AVIARY_HISTORY_DAYS)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {stale.length > shown && (
                  <Button variant="ghost" size="sm" className="mt-2 self-start" onClick={() => setShown((n) => n + PAGE)}>
                    Show more ({stale.length - shown} left)
                  </Button>
                )}
                <p className="mt-2 text-[11px] text-faint">A missing entry means nobody logged the bird, not that it is missing.</p>
              </>
            )}
          </Card>
        </div>
      </AviaryFrame>
    </div>
  );
}

function Kpi({ icon: Icon, color, value, label, hint, tag }: { icon: typeof Bird; color: string; value: number | string; label: string; hint?: string; tag?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${color}1f`, color }} aria-hidden>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="num text-2xl font-semibold leading-tight">{value}</p>
          {tag}
        </div>
        <p className="truncate text-xs text-muted">{label}</p>
        {hint && <p className="text-[11px] text-faint">{hint}</p>}
      </div>
    </div>
  );
}
