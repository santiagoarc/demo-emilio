"use client";

import { ClipboardCheck, ExternalLink, Layers, ListChecks, Scale } from "lucide-react";
import { AVIARY_ESTIMATE, AVIARY_SPECIES, INVENTORY_REQUEST } from "@/domain/aviary";
import { DEMO_SPLIT } from "@/data/aviarySimulate";
import { fmtAvDayLong } from "@/logic/aviary";
import { PageHeader } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/primitives";
import { AviaryFrame, DemoTag, PresenceBadge, SpeciesDot } from "./common";

const fmtIso = (iso: string) => fmtAvDayLong(new Date(`${iso}T12:00:00`).getTime());

const LEVELS = [
  { title: "Species in the world", text: "Every bird species described by science. Thousands — not something this module tracks." },
  { title: "Species kept by SeaWorld Abu Dhabi", text: "Everything the park holds across all realms. Only partly public; SeaWorld has the authoritative list." },
  { title: "Species in this aviary", text: "The subset housed in the aviary module. Publicly we only know the groups below; the list is not provided yet." },
  { title: "Counts recorded in this aviary", text: "How many birds of each species, with the date of the count. Not provided — every count in this demo is simulated." },
];

export function AviaryInventory() {
  const demoTotal = Object.values(DEMO_SPLIT).reduce((a, b) => a + b, 0);
  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Aviary · Inventory"
        title="Inventory skeleton"
        subtitle="What we know about the aviary's species today, where each claim comes from, and what SeaWorld would need to provide."
      />
      <AviaryFrame banner="The table structure is ready for a real inventory. Until SeaWorld provides one, confirmed counts stay empty and only demo counts are shown.">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="panel p-5">
            <p className="eyebrow">Meeting estimate</p>
            <p className="num mt-1 text-3xl font-semibold">{AVIARY_ESTIMATE.label}</p>
            <p className="mt-1 text-xs text-muted">{AVIARY_ESTIMATE.status}</p>
          </div>
          <div className="panel p-5">
            <p className="eyebrow">Confirmed head count</p>
            <p className="mt-1 text-3xl font-semibold text-faint">To be confirmed</p>
            <p className="mt-1 text-xs text-muted">No count per species has been provided.</p>
          </div>
          <div className="panel p-5">
            <p className="eyebrow flex items-center gap-2">Demo roster <DemoTag /></p>
            <p className="num mt-1 text-3xl font-semibold">{demoTotal}</p>
            <p className="mt-1 text-xs text-muted">Simulated records standing in for the estimate.</p>
          </div>
        </div>

        <Card title="Species groups" subtitle="From public sources only. Nothing here is confirmed for this aviary yet." icon={Layers}>
          <div className="scroll-thin -mx-5 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <caption className="sr-only">Aviary inventory skeleton by species group</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
                  <th scope="col" className="px-5 py-2.5 font-medium">Species group</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Scientific name / group</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Presence</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Confirmed count</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Demo count</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {AVIARY_SPECIES.map((s) => (
                  <tr key={s.id} className="border-t border-line align-top">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2 font-medium">
                        <SpeciesDot id={s.id} /> {s.name}
                      </span>
                      <span className="mt-1 block max-w-[260px] text-[11px] text-muted">{s.note}</span>
                    </td>
                    <td className="px-3 py-3 italic text-muted">{s.scientific}</td>
                    <td className="px-3 py-3"><PresenceBadge status={s.presence} /></td>
                    <td className="num px-3 py-3 text-right">{s.confirmedCount ?? <span className="text-faint">To be confirmed</span>}</td>
                    <td className="num px-3 py-3 text-right">
                      {DEMO_SPLIT[s.id]} <DemoTag className="ml-1" />
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {s.source ? (
                        <>
                          <a href={s.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                            {s.source.title} <ExternalLink size={11} aria-hidden />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                          <span className="mt-0.5 block text-muted">{s.source.publisher}</span>
                          <span className="block text-faint">
                            {s.source.published ? `Published ${fmtIso(s.source.published)} · ` : ""}Accessed {fmtIso(s.source.accessed)}
                          </span>
                        </>
                      ) : (
                        <span className="text-faint">Not provided</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong text-sm">
                  <td className="px-5 py-2.5 font-medium" colSpan={3}>Total</td>
                  <td className="px-3 py-2.5 text-right text-faint">To be confirmed</td>
                  <td className="num px-3 py-2.5 text-right font-medium">{demoTotal} <DemoTag className="ml-1" /></td>
                  <td className="px-5 py-2.5 text-xs text-muted">Estimate {AVIARY_ESTIMATE.label}, to be confirmed</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="What SeaWorld needs to provide" subtitle="To replace the demo roster with a real inventory" icon={ListChecks}>
            <ol className="space-y-2.5">
              {INVENTORY_REQUEST.map((item, i) => (
                <li key={item} className="flex gap-3 text-sm">
                  <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/12 text-xs font-semibold text-accent">{i + 1}</span>
                  <span className="pt-0.5 text-ink">{item}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Four different questions" subtitle="Kept apart so no number is read as something it is not" icon={Scale}>
            <ul className="space-y-3">
              {LEVELS.map((l, i) => (
                <li key={l.title} className="flex gap-3">
                  <ClipboardCheck size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  <div>
                    <p className="text-sm font-medium">
                      <span className="num mr-1 text-faint">{i + 1}.</span>
                      {l.title}
                    </p>
                    <p className="text-xs text-muted">{l.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </AviaryFrame>
    </div>
  );
}
