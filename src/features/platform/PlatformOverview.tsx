"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ArrowRight, Bird, BookOpenCheck, Feather, FlaskConical, Database, CircleHelp } from "lucide-react";
import { AVIARY_ESTIMATE, AVIARY_SPECIES } from "@/domain/aviary";
import { SPECIES } from "@/domain/species";
import { daysSinceSeen } from "@/logic/aviary";
import { HOUR } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { useAviary } from "@/state/useAviary";
import { Badge, Card, SimulatedTag, cx } from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/AppShell";

/**
 * Landing page for both areas: what each one shows, how much of it is real,
 * and where to go next. Every figure is computed from the demo data.
 */
export function PlatformOverview() {
  const { dataset, snapshots, insights, now } = useDemo();
  const { ds: aviary } = useAviary();

  const penguins = useMemo(() => {
    const total = dataset.penguins.length;
    const located = [...snapshots.values()].filter((s) => s.reading && now - s.reading.timestamp <= HOUR).length;
    const attention = [...insights.values()].filter((i) => i.level !== "ok").length;
    return { total, located, attention };
  }, [dataset, snapshots, insights, now]);

  const birds = useMemo(() => {
    const total = aviary.birds.length;
    const seen3d = aviary.birds.filter((b) => {
      const d = daysSinceSeen(aviary, b.id);
      return d !== null && d < 3;
    }).length;
    return { total, seen3d, notSeen: total - seen3d };
  }, [aviary]);

  return (
    <div className="pb-12">
      <PageHeader
        eyebrow="SeaWorld Abu Dhabi · concept demo"
        title="Animal care platform"
        subtitle={
          <>
            A tool shaped around the care teams’ own processes: look up an animal, see where it was last recorded and how it is doing, by species, zone and team.{" "}
            <SimulatedTag />
          </>
        }
      />

      <div className="space-y-5 px-6 lg:px-8">
        <div className="grid gap-5 xl:grid-cols-2">
          <AreaCard
            icon={Bird}
            title="Penguins"
            href="/penguins/overview"
            data="Simulated location readings every 30 minutes from a hypothetical tracking setup. Activity in water and on land is derived from those readings."
            stats={[
              { label: "Penguins in the demo", value: penguins.total, hint: "Demo roster · not a confirmed inventory" },
              { label: "Species", value: SPECIES.length, hint: "Named publicly by SeaWorld · counts are demo" },
              { label: "Located in the last hour", value: `${Math.round((penguins.located / Math.max(1, penguins.total)) * 100)}%`, hint: "Share with a simulated reading ≤ 60 min old" },
              { label: "Worth a look", value: penguins.attention, hint: "Activity differs from usual · inference, not diagnosis" },
            ]}
            links={[
              { href: "/map", label: "Habitat map" },
              { href: "/penguins", label: "Penguin registry" },
              { href: "/analytics", label: "Activity" },
            ]}
          />
          <AreaCard
            icon={Feather}
            title="Aviary"
            href="/aviary"
            data="Simulated keeper sightings, logged by hand at zone level. No tags, chips or live positions are assumed for birds."
            stats={[
              { label: "Birds in the demo", value: birds.total, hint: `Stands in for the ${AVIARY_ESTIMATE.label} estimate · to be confirmed` },
              { label: "Species groups", value: AVIARY_SPECIES.length, hint: "3 named publicly by SeaWorld · 1 not provided" },
              { label: "Seen in the last 3 days", value: `${Math.round((birds.seen3d / Math.max(1, birds.total)) * 100)}%`, hint: "Share with a logged sighting" },
              { label: "Not seen ≥ 3 days", value: birds.notSeen, hint: "Logbook gap, not a welfare signal" },
            ]}
            links={[
              { href: "/aviary/birds", label: "Find a bird" },
              { href: "/aviary/habitat", label: "Habitat" },
              { href: "/aviary/inventory", label: "Inventory to confirm" },
            ]}
          />
        </div>

        <Card title="How to read the numbers" icon={Database} subtitle="Three kinds of information appear in this demo">
          <div className="grid gap-3 md:grid-cols-3">
            <Kind
              tone="neutral"
              label="Simulated"
              items={["Every animal record, name, band and ID", "Location readings, sightings and movements", "Health follow-up cases and care notes", "Teams and people"]}
            />
            <Kind
              tone="info"
              label="From a public source"
              items={["Six penguin species named by SeaWorld Abu Dhabi", "Toucans, parrots and Caribbean flamingos named for the Tropical Ocean realm", "Source and consultation date are shown next to each item"]}
            />
            <Kind
              tone="warn"
              label="To be confirmed by SeaWorld"
              items={["Real head counts per species (penguins and birds)", "The ≈500-bird aviary estimate", "Aviary species list, zones and responsible teams", "Any tracking technology and its suitability"]}
            />
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Teaser
            icon={FlaskConical}
            title="Potential capabilities"
            text="Health, behaviour, feeding and breeding follow-up are shown as possibilities. They need technical, clinical and operational evaluation before anyone relies on them."
          />
          <Teaser
            icon={CircleHelp}
            title="Technology to validate"
            text="Open questions about identification, antennas, coverage, size, cost and habitat aesthetics. The demo does not assume any device works in these habitats."
          />
        </div>
      </div>
    </div>
  );
}

function AreaCard({ icon: Icon, title, href, data, stats, links }: {
  icon: typeof Bird;
  title: string;
  href: string;
  data: string;
  stats: { label: string; value: ReactNode; hint: string }[];
  links: { href: string; label: string }[];
}) {
  return (
    <section className="panel fade-up flex flex-col p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/12 text-accent">
            <Icon size={22} />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
            <p className="text-xs text-muted">Demo data</p>
          </div>
        </div>
        <Link href={href} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-medium text-white hover:bg-[#0b8178]">
          Open <ArrowRight size={15} />
        </Link>
      </header>
      <p className="mt-4 text-sm text-muted">{data}</p>
      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 border-l-2 border-line pl-3">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="num mt-0.5 text-2xl font-semibold text-ink">{s.value}</dd>
            <dd className="text-[11px] leading-snug text-faint">{s.hint}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="inline-flex h-8 items-center rounded-lg border border-line-strong px-2.5 text-xs text-ink hover:border-accent/50">
            {l.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function Kind({ tone, label, items }: { tone: "neutral" | "info" | "warn"; label: string; items: string[] }) {
  return (
    <div className={cx("rounded-xl border p-4", tone === "warn" ? "border-warn/30 bg-warn/[0.04]" : tone === "info" ? "border-accent-2/30 bg-accent-2/[0.04]" : "border-line bg-ink/[0.02]")}>
      <Badge tone={tone}>{label}</Badge>
      <ul className="mt-3 space-y-1.5">
        {items.map((i) => (
          <li key={i} className="flex gap-2 text-xs text-muted">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-faint" />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Teaser({ icon: Icon, title, text }: { icon: typeof Bird; title: string; text: string }) {
  return (
    <Link href="/roadmap" className="panel group flex gap-4 p-5 transition hover:border-accent/40">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink/[0.05] text-muted group-hover:text-accent">
        <Icon size={19} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          {title} <BookOpenCheck size={14} className="text-faint" />
        </span>
        <span className="mt-1 block text-sm text-muted">{text}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent">
          Validation & roadmap <ArrowRight size={12} />
        </span>
      </span>
    </Link>
  );
}
