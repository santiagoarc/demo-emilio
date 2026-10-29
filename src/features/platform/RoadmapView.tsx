"use client";

import { CircleHelp, Database, ExternalLink, FlaskConical, Ban } from "lucide-react";
import { INVENTORY_REQUEST, SEAWORLD_REALMS_SOURCE } from "@/domain/aviary";
import { Badge, Card } from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/AppShell";

type Status = "simulated" | "sourced" | "pending";

const STATUS: Record<Status, { label: string; tone: "neutral" | "info" | "warn" }> = {
  simulated: { label: "Simulated", tone: "neutral" },
  sourced: { label: "Public source", tone: "info" },
  pending: { label: "To be confirmed", tone: "warn" },
};

const DATA_STATUS: { item: string; status: Status; detail: string; source?: boolean }[] = [
  { item: "Penguin species (6)", status: "sourced", detail: "King, Gentoo, Chinstrap, Macaroni, Rockhopper and Adélie are named by SeaWorld Abu Dhabi for the Antarctica realm.", source: true },
  { item: "Penguin head count (206)", status: "pending", detail: "Demo scenario figure from the meeting. Not a confirmed inventory; split per species is a demo assumption." },
  { item: "Penguin locations, activity and movements", status: "simulated", detail: "Generated readings every 30 minutes. They illustrate what a validated tracking setup could provide." },
  { item: "Aviary species groups", status: "sourced", detail: "Toucans and parrots (The Rainforest aviary) are named publicly. No species list or counts are published.", source: true },
  { item: "Aviary demo registry (32 species, 500 birds)", status: "simulated", detail: "Catalogue and counts chosen for the demo; every bird, tree, device, position and movement is fictional." },
  { item: "Real aviary inventory and layout", status: "pending", detail: "Species list, head counts, plans and tree inventory would come from SeaWorld." },
  { item: "Health follow-up cases, care notes, teams, people", status: "simulated", detail: "Fictional records to show the workflow. No clinical data is used." },
];

const CAPABILITIES: { area: string; today: string; observed: string; inferred: string; needs: string; notClaimed: string }[] = [
  {
    area: "Health follow-up",
    today: "Teams open a follow-up case, log progress and weights by hand, and see how the animal’s activity compares with its species and with its own previous days.",
    observed: "Entries written by keepers; time in water / on land from readings.",
    inferred: "“Worth a look” flags when activity departs from the usual pattern.",
    needs: "Clinical protocols from the veterinary team; validated activity data; agreed thresholds.",
    notClaimed: "Diagnosing disease, detecting arrhythmias or identifying injuries.",
  },
  {
    area: "Behaviour",
    today: "Activity by hour, zone transitions and long stretches with no movement recorded.",
    observed: "Where and when the animal was recorded.",
    inferred: "Changes in routine compared with the species and the animal’s own history.",
    needs: "Behavioural definitions from keepers and a way to label events to check any model against.",
    notClaimed: "Confirming fights, stress or social conflict.",
  },
  {
    area: "Feeding",
    today: "Feeding zones appear in visits and sightings; aviary keepers log feeding checks.",
    observed: "Presence at a feeding zone or a logged feeding check.",
    inferred: "Nothing about intake: being at a station is not eating.",
    needs: "Feeding records per animal (who ate what and how much) from the current process.",
    notClaimed: "Measuring food intake.",
  },
  {
    area: "Breeding & nesting",
    today: "Not shown with data. Nesting zones exist on the layouts only as places.",
    observed: "—",
    inferred: "—",
    needs: "Nest monitoring method (cameras, checks, weights) and a validation study.",
    notClaimed: "Detecting egg-laying or incubation.",
  },
  {
    area: "Activity assignment",
    today: "Each animal has one responsible team; teams and their zones can be edited in the penguin area.",
    observed: "Current assignments.",
    inferred: "—",
    needs: "How SeaWorld plans daily care tasks today and which system holds them.",
    notClaimed: "Tracking staff. Wearables for employees are out of scope.",
  },
];

const QUESTIONS: { topic: string; items: string[] }[] = [
  {
    topic: "Identification",
    items: [
      "Which identification is already in use per species (bands, rings, transponders)? Can the platform read it as it is?",
      "For any implant or tag: manufacturer specification (size, weight, read range, lifespan) and veterinary approval per species.",
      "Is any tag suitable for small or delicate birds at all? Which species would be excluded?",
    ],
  },
  {
    topic: "Antennas & coverage",
    items: [
      "What read range is achievable in water, on ice/snow and under the aviary canopy? This needs an on-site survey.",
      "Where could antennas or readers be placed (gates, feeding stations, pools) and how many?",
      "Does under-water positioning work in these pools, and with what accuracy?",
    ],
  },
  {
    topic: "Habitat & guests",
    items: [
      "Which installations are acceptable visually in guest-facing areas?",
      "Maintenance access, cleaning cycles and water treatment constraints.",
    ],
  },
  {
    topic: "Cost & operation",
    items: [
      "Hardware, installation and maintenance cost per habitat, and per animal where tags are involved.",
      "Who logs sightings or care entries today, how often, and in which system?",
      "Which existing systems (animal records, veterinary software) must the platform read from or write to?",
    ],
  },
];

export function RoadmapView() {
  return (
    <div className="pb-12">
      <PageHeader
        eyebrow="Overview"
        title="Validation & roadmap"
        subtitle="What is simulated, what comes from a public source, and what SeaWorld would need to confirm before any of this becomes operational."
      />

      <div className="space-y-5 px-6 lg:px-8">
        <Card title="Data status" icon={Database} subtitle="Every figure in the demo falls into one of these categories">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Status of each data set used in the demo</caption>
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Data</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {DATA_STATUS.map((d) => (
                  <tr key={d.item} className="border-b border-line/60 align-top last:border-0">
                    <td className="px-3 py-2.5 font-medium text-ink">{d.item}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">
                      {d.detail}
                      {d.source && (
                        <a href={SEAWORLD_REALMS_SOURCE.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-accent hover:underline">
                          {SEAWORLD_REALMS_SOURCE.publisher}, {SEAWORLD_REALMS_SOURCE.published} <ExternalLink size={11} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-faint">
            Source consulted on {SEAWORLD_REALMS_SOURCE.accessed}. It names species for the park’s realms; it does not confirm what is in a specific exhibit or how many animals there are.
          </p>
        </Card>

        <Card
          title="Potential capabilities"
          icon={FlaskConical}
          subtitle="Possibilities, not confirmed features. Each one requires technical, clinical and operational evaluation."
        >
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {CAPABILITIES.map((c) => (
              <article key={c.area} className="flex flex-col rounded-xl border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{c.area}</h3>
                  <Badge tone="warn">Requires validation</Badge>
                </div>
                <p className="mt-2 text-xs text-muted">{c.today}</p>
                <dl className="mt-3 space-y-2 text-xs">
                  <Row k="Observed" v={c.observed} />
                  <Row k="Inferred" v={c.inferred} />
                  <Row k="Would need" v={c.needs} />
                  <Row k="Not claimed" v={c.notClaimed} strong />
                </dl>
              </article>
            ))}
          </div>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <Card title="Technology to validate" icon={CircleHelp} subtitle="Open questions. The demo does not assume any device, antenna or implant works in these habitats.">
            <div className="grid gap-4 md:grid-cols-2">
              {QUESTIONS.map((q) => (
                <div key={q.topic}>
                  <p className="eyebrow mb-2">{q.topic}</p>
                  <ul className="space-y-2">
                    {q.items.map((i) => (
                      <li key={i} className="flex gap-2 text-xs text-muted">
                        <CircleHelp size={13} className="mt-px shrink-0 text-faint" />
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-lg bg-ink/[0.03] px-3 py-2 text-[11px] text-muted">
              Any map or coverage drawing in the demo is illustrative, not a site survey. Specifications mentioned informally (tag size, lifespan, suitability) need a manufacturer source and veterinary validation.
            </p>
          </Card>

          <div className="space-y-5">
            <Card title="What SeaWorld would provide" icon={Database} subtitle="To replace the aviary demo roster with a real inventory">
              <ol className="list-decimal space-y-1.5 pl-5 text-xs text-muted">
                {INVENTORY_REQUEST.map((r) => (
                  <li key={r}>{r}</li>
                ))}
                <li>Penguin head count per species, with the date of the count.</li>
              </ol>
            </Card>
            <Card title="Out of scope" icon={Ban}>
              <p className="text-xs text-muted">
                Employee tracking and staff wearables are not part of this platform. Teams appear only as the people responsible for animals.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[84px_1fr] gap-2">
      <dt className="text-faint">{k}</dt>
      <dd className={strong ? "text-ink" : "text-muted"}>{v}</dd>
    </div>
  );
}
