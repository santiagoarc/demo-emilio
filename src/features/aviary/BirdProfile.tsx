"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Bird, ClipboardList, Hand, MapPin, NotebookPen, Route, Users } from "lucide-react";
import { AVIARY_SPECIES_BY_ID, AVIARY_TEAM_BY_ID, AVIARY_ZONE_BY_ID, type ObservationKind } from "@/domain/aviary";
import { AVIARY_HISTORY_DAYS } from "@/data/aviarySimulate";
import { birdSightingsPerDay, daysAgoLabel, daysSinceSeen, fmtAvDateTime, fmtAvDay, fmtAvDayLong, lastObservation, zoneMoves } from "@/logic/aviary";
import { useAviary } from "@/state/useAviary";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, Button, Card, EmptyState } from "@/components/ui/primitives";
import { StackedColumns } from "@/components/charts/Charts";
import { AviaryFrame, DemoTag, PresenceBadge, SpeciesDot } from "./common";

const KIND_LABEL: Record<ObservationKind, string> = { sighting: "Sighting", feeding: "Feeding", headcount: "Headcount", note: "Note" };
const KIND_TONE: Record<ObservationKind, "neutral" | "accent" | "info" | "warn"> = { sighting: "neutral", feeding: "accent", headcount: "info", note: "warn" };
const PAGE = 15;

export function BirdProfile() {
  const { id } = useParams<{ id: string }>();
  const { ds, birdById } = useAviary();
  const bird = birdById.get(decodeURIComponent(id ?? ""));
  const [shown, setShown] = useState(PAGE);

  const list = useMemo(() => (bird ? ds.observations.get(bird.id) ?? [] : []), [ds, bird]);
  const moves = useMemo(() => zoneMoves(list).reverse(), [list]);
  const perDay = useMemo(() => (bird ? birdSightingsPerDay(ds, bird.id) : []), [ds, bird]);

  if (!bird) {
    return (
      <div className="pb-10">
        <PageHeader eyebrow="Aviary · Bird profile" title="Bird not found" />
        <div className="px-6 lg:px-8">
          <div className="panel">
            <EmptyState
              icon={Bird}
              title={`No bird with ID “${id}” in the demo roster`}
              action={
                <Link href="/aviary/birds" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3.5 text-sm font-medium text-ink hover:border-accent/50">
                  <ArrowLeft size={14} /> Back to registry
                </Link>
              }
            >
              Demo IDs look like TCN-001, PRT-042, FLM-007 or AVX-120.
            </EmptyState>
          </div>
        </div>
      </div>
    );
  }

  const sp = AVIARY_SPECIES_BY_ID[bird.speciesId];
  const team = AVIARY_TEAM_BY_ID[bird.teamId];
  const last = lastObservation(ds, bird.id);
  const days = daysSinceSeen(ds, bird.id);
  const lastZone = last ? AVIARY_ZONE_BY_ID[last.zoneId] : undefined;
  const timeline = [...list].reverse();

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Aviary · Bird profile"
        title={bird.name ? `${bird.id} · ${bird.name}` : bird.id}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><SpeciesDot id={bird.speciesId} /> {sp.name} <DemoTag>Demo record</DemoTag></span>}
        actions={
          <Link href="/aviary/birds" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-muted hover:bg-ink/5 hover:text-ink">
            <ArrowLeft size={14} /> Registry
          </Link>
        }
      />
      <AviaryFrame banner="This profile is a simulated record. Sightings are what a keeper would log by hand at zone level — there are no sensors or live positions behind them.">
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Identification" icon={ClipboardList}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Demo ID</dt>
              <dd className="font-mono font-medium">{bird.id}</dd>
              <dt className="text-muted">Band</dt>
              <dd className="font-mono">{bird.bandId}</dd>
              <dt className="text-muted">Name</dt>
              <dd>{bird.name ?? <span className="text-faint">No name recorded</span>}</dd>
              <dt className="text-muted">Species group</dt>
              <dd>{sp.name}</dd>
              <dt className="text-muted">Scientific</dt>
              <dd className="italic text-muted">{sp.scientific}</dd>
              <dt className="text-muted">Presence</dt>
              <dd><PresenceBadge status={sp.presence} /></dd>
              <dt className="text-muted">Registered</dt>
              <dd className="num">{fmtAvDayLong(bird.registeredAt)} <DemoTag className="ml-1" /></dd>
            </dl>
            <p className="mt-4 text-[11px] text-faint">
              The band ID is a placeholder. Birds are not assumed to carry chips; the real identification method is to be confirmed.
            </p>
          </Card>

          <Card title="Responsible team" icon={Users} action={<DemoTag>Fictional</DemoTag>}>
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: team.color }} aria-hidden />
              {team.name}
            </p>
            <p className="mt-3 text-[11px] uppercase tracking-wider text-faint">Lead</p>
            <p className="text-sm">{team.lead}</p>
            <p className="mt-3 text-[11px] uppercase tracking-wider text-faint">Members</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {team.members.map((m) => (
                <li key={m} className="rounded-md border border-line px-1.5 py-0.5 text-xs text-muted">{m}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] uppercase tracking-wider text-faint">Zones covered</p>
            <p className="text-xs text-muted">{team.zoneIds.map((z) => AVIARY_ZONE_BY_ID[z].name).join(" · ")}</p>
          </Card>

          <Card title="Last recorded zone" icon={MapPin}>
            {last && lastZone ? (
              <>
                <p className="text-xl font-semibold tracking-tight">{lastZone.name}</p>
                {lastZone.offExhibit && <Badge tone="warn" className="mt-1">Off exhibit</Badge>}
                <p className="num mt-2 text-sm text-muted">{fmtAvDateTime(last.at)} · {daysAgoLabel(days, AVIARY_HISTORY_DAYS)}</p>
                <p className="mt-1 text-xs text-muted">Logged by {last.by} ({KIND_LABEL[last.kind].toLowerCase()})</p>
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-ink/[0.03] p-3 text-xs text-muted">
                  <Hand size={14} className="mt-0.5 shrink-0" aria-hidden />
                  <span>Manual keeper sighting — not a live location. The bird may have moved since.</span>
                </div>
                <Link href={`/aviary/habitat?zone=${lastZone.id}`} className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                  View zone on the habitat plan <ArrowRight size={12} />
                </Link>
              </>
            ) : (
              <EmptyState icon={MapPin} title={`No sighting in the last ${AVIARY_HISTORY_DAYS} days`}>
                Nobody logged this bird in the demo window. That is a logbook gap, not a confirmed absence.
              </EmptyState>
            )}
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-5">
          <Card className="lg:col-span-3" title="Observation history" subtitle={`${list.length} entries in the last ${AVIARY_HISTORY_DAYS} days · newest first`} icon={NotebookPen} action={<DemoTag />}>
            {timeline.length === 0 ? (
              <EmptyState icon={NotebookPen} title="No logbook entries">No observations were logged for this bird in the demo window.</EmptyState>
            ) : (
              <>
                <ol className="relative ml-1.5 border-l border-line">
                  {timeline.slice(0, shown).map((o) => {
                    const z = AVIARY_ZONE_BY_ID[o.zoneId];
                    return (
                      <li key={o.id} className="relative pb-4 pl-5 last:pb-0">
                        <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-panel-solid" style={{ background: sp.color }} aria-hidden />
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Badge tone={KIND_TONE[o.kind]}>{KIND_LABEL[o.kind]}</Badge>
                          <span className="text-sm font-medium">{z.name}</span>
                          {z.offExhibit && <Badge tone="warn">Off exhibit</Badge>}
                          <span className="num ml-auto text-xs text-muted">{fmtAvDateTime(o.at)}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-faint">Logged by {o.by}</p>
                        {o.text && <p className="mt-1 text-sm text-muted">{o.text}</p>}
                      </li>
                    );
                  })}
                </ol>
                {timeline.length > shown && (
                  <Button variant="ghost" size="sm" className="mt-3 self-start" onClick={() => setShown((n) => n + PAGE)}>
                    Show older entries ({timeline.length - shown} left)
                  </Button>
                )}
              </>
            )}
          </Card>

          <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
            <Card title="Sightings per day" subtitle={`Logbook entries for this bird · last ${AVIARY_HISTORY_DAYS} days`} icon={NotebookPen} action={<DemoTag />}>
              <div role="img" aria-label={`Bar chart of logbook entries per day for ${bird.id}`}>
                <StackedColumns
                  height={90}
                  labelEvery={3}
                  data={perDay.map((d) => ({ label: fmtAvDay(d.day), tooltip: fmtAvDayLong(d.day), values: { s: d.sightings } }))}
                  series={[{ key: "s", color: sp.color, label: "Entries" }]}
                />
              </div>
              <p className="mt-2 text-[11px] text-faint">A day without entries means nobody logged the bird that day.</p>
            </Card>

            <Card title="Zone changes" subtitle="Between consecutive sightings" icon={Route} action={<DemoTag />}>
              {moves.length === 0 ? (
                <p className="text-sm text-muted">{list.length ? "Always logged in the same zone during the window." : "No sightings to compare."}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {moves.slice(0, 8).map((m) => (
                    <li key={`${m.prevAt}-${m.at}`} className="py-2 text-sm">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="text-muted">{AVIARY_ZONE_BY_ID[m.from].name}</span>
                        <ArrowRight size={12} className="text-faint" aria-label="to" />
                        <span className="font-medium">{AVIARY_ZONE_BY_ID[m.to].name}</span>
                      </p>
                      <p className="num text-[11px] text-faint">
                        Between {fmtAvDateTime(m.prevAt)} and {fmtAvDateTime(m.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {moves.length > 8 && <p className="mt-1 text-[11px] text-faint">+{moves.length - 8} earlier changes</p>}
              <p className="mt-3 text-[11px] text-faint">
                Times are bounds: the bird moved at some point between the two sightings. The exact moment and route are unknown.
              </p>
            </Card>
          </div>
        </div>
      </AviaryFrame>
    </div>
  );
}
