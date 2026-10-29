"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BatteryMedium, ChevronLeft, ChevronRight, ExternalLink, MapPinned, Navigation, Radio, Ruler, Search, SearchX } from "lucide-react";
import {
  AGE_LABEL,
  DEVICE_STATUS_LABEL,
  FIX_STATUS,
  GROUP_LABEL,
  LEVELS,
  LEVEL_BY_ID,
  MONITOR_ZONE_BY_ID,
  type AgeClass,
  type FixStatus,
} from "@/domain/aviaryTracking";
import { MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { SPECIES_INFO } from "@/data/aviarySpeciesInfo";
import { fmtHeight, type Fix } from "@/logic/aviaryTracking";
import { fmtAgo } from "@/logic/time";
import { Card, Chip, EmptyState, cx } from "@/components/ui/primitives";
import { AviaryFrame, useAviarySnapshot } from "./common";

const AGES: AgeClass[] = ["juvenile", "subadult", "adult", "senior"];
const STATUSES: FixStatus[] = ["detected", "moving", "stale", "no-signal"];

/** One species: photo and summary on top, every demo bird of the species below. */
export function AviarySpeciesDetail() {
  const { id } = useParams<{ id: string }>();
  const sp = MONITOR_SPECIES_BY_ID[id];
  if (!sp) {
    return (
      <div className="p-8">
        <Card>
          <EmptyState icon={SearchX} title={`Species "${id}" not found`} action={<Link href="/aviary/species" className="text-sm text-accent hover:underline">Back to Species</Link>} />
        </Card>
      </div>
    );
  }
  return <Detail speciesId={sp.id} />;
}

function Detail({ speciesId }: { speciesId: string }) {
  const { registry, fixes, asOf } = useAviarySnapshot();
  const sp = MONITOR_SPECIES_BY_ID[speciesId];
  const info = SPECIES_INFO[sp.code];
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<FixStatus | null>(null);

  const all: Fix[] = useMemo(() => [...fixes.values()].filter((f) => f.bird.speciesId === speciesId), [fixes, speciesId]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((f) => (!status || f.status === status) && (!t || f.bird.id.toLowerCase().includes(t) || (f.bird.name ?? "").toLowerCase().includes(t)));
  }, [all, q, status]);

  const n = all.length;
  const detected = all.filter((f) => f.status === "detected" || f.status === "moving").length;
  const moving = all.filter((f) => f.status === "moving").length;
  const heights = all.map((f) => f.det?.pos?.y).filter((h): h is number => h != null);
  const avgHeight = heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : null;
  const males = all.filter((f) => f.bird.sex === "male").length;
  const females = all.filter((f) => f.bird.sex === "female").length;
  const ages = AGES.map((a) => ({ a, n: all.filter((f) => f.bird.ageClass === a).length }));
  const zones = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of all) if (f.det?.zoneId) m.set(f.det.zoneId, (m.get(f.det.zoneId) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);

  return (
    <div className="pb-10">
      {/* Header, as in the penguin species page */}
      <div className="flex flex-wrap items-center gap-4 px-6 pb-4 pt-6 lg:px-8">
        <Link
          href="/aviary/species"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 pl-2.5 pr-4 text-sm font-medium text-ink transition hover:border-accent hover:bg-accent/20"
        >
          <ChevronLeft size={18} className="text-accent" />
          All species
        </Link>
        <span className="hidden h-10 w-px bg-line sm:block" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={info.photo.src} alt="" className="h-[60px] w-[60px] rounded-2xl object-cover shadow-sm" />
        <div className="min-w-0 flex-1">
          <nav className="flex items-center gap-1 text-xs text-muted">
            <Link href="/aviary/species" className="hover:text-ink">Species</Link>
            <ChevronRight size={12} className="text-faint" />
            <span className="text-ink">{sp.common}</span>
          </nav>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{sp.common}</h1>
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: sp.color }} />
              <i>{sp.scientific}</i> · {sp.commonEs}
            </span>
            <span className="rounded-md bg-warn px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">DEMO / SIMULATED DATA</span>
          </div>
        </div>
        <Link
          href={`/aviary/map?species=${sp.id}`}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-line-strong px-3.5 text-sm font-medium text-ink transition hover:border-accent/50"
        >
          <MapPinned size={15} /> View on map
        </Link>
      </div>

      <AviaryFrame banner="The photo and description are about the species in general (Wikipedia / Wikimedia Commons). The birds, counts and positions below are fictional demo data.">
        {/* Summary */}
        <section className="panel grid overflow-hidden lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <figure className="relative min-h-[260px] bg-ink/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={info.photo.src} alt={`${sp.common} (${sp.scientific}), reference photo`} className="absolute inset-0 h-full w-full object-cover" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-2.5 pt-8 text-[10px] text-white/85">
              Reference photo of the species, not of a SeaWorld bird · {info.photo.author} ·{" "}
              <a href={info.photo.page} target="_blank" rel="noreferrer" className="underline hover:text-white">
                {info.photo.license}, Wikimedia Commons
              </a>
            </figcaption>
          </figure>
          <div className="p-5">
            <p className="eyebrow">{GROUP_LABEL[sp.group]} · code {sp.code}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink">{info.summary}</p>
            <a href={info.article} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
              From Wikipedia (CC BY-SA 4.0) <ExternalLink size={11} />
            </a>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Kpi icon={<span className="text-[11px] font-bold">{sp.code}</span>} color={sp.color} value={n} label="Demo birds" />
              <Kpi icon={<Radio size={17} />} color={FIX_STATUS.detected.color} value={detected} label="Detected now" />
              <Kpi icon={<Navigation size={17} />} color={FIX_STATUS.moving.color} value={moving} label="Moving now" />
              <Kpi icon={<Ruler size={17} />} color="#0891B2" value={avgHeight == null ? "—" : `${avgHeight.toFixed(1)} m`} label="Average height" />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-xs">
              <Fact k="Usual heights (demo)" v={sp.prefLevels.map((l) => LEVEL_BY_ID[l].short).join(", ")} />
              <Fact k="Usual zones (demo)" v={sp.prefZones.map((z) => MONITOR_ZONE_BY_ID[z].name).join(", ")} />
              <Fact k="Sex" v={sp.dimorphic ? `${males} male · ${females} female · ${n - males - females} not yet sexed` : "Not recorded (males and females look alike)"} />
              <Fact k="Age" v={ages.map((x) => `${x.n} ${AGE_LABEL[x.a].toLowerCase()}`).join(" · ")} />
              <Fact k="Where now" v={zones.map(([z, c]) => `${MONITOR_ZONE_BY_ID[z].code} ${c}`).join(" · ") || "—"} />
              <Fact k="Requested in the brief" v={sp.requestedCount === n ? `${n}` : `${sp.requestedCount} → ${n} (total adjusted to 500)`} />
            </dl>
          </div>
        </section>

        {/* Every bird */}
        <section className="panel p-4">
          <header className="flex flex-wrap items-center gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight">Birds of this species</h2>
            <span className="text-xs text-muted">
              {rows.length} of {n}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <Chip key={s} active={status === s} color={FIX_STATUS[s].color} onClick={() => setStatus(status === s ? null : s)}>
                    {FIX_STATUS[s].label} {all.filter((f) => f.status === s).length}
                  </Chip>
                ))}
              </div>
              <label className="relative">
                <span className="sr-only">Search by ID or name</span>
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ID or name…"
                  className="h-8 w-40 rounded-lg border border-line-strong bg-panel-solid pl-8 pr-2 text-xs text-ink outline-none placeholder:text-faint focus:border-accent/60"
                />
              </label>
            </div>
          </header>

          {rows.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">No bird matches.</p>
          ) : (
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {rows.map((f) => (
                <li key={f.bird.id}>
                  <BirdTile fix={f} asOf={asOf} color={sp.color} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-faint">Positions as of the saved simulated clock. {registry.birds.length} birds in the whole demo registry.</p>
        </section>
      </AviaryFrame>
    </div>
  );
}

function BirdTile({ fix, asOf, color }: { fix: Fix; asOf: number; color: string }) {
  const { bird, det, status } = fix;
  const battery = bird.device.batteryPct;
  return (
    <Link href={`/aviary/map?bird=${bird.id}`} className="group block rounded-xl border border-line bg-panel-solid p-3 transition hover:border-accent/50 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-baseline gap-1.5">
            <span className="font-mono text-[13px] font-semibold text-ink">{bird.id}</span>
            {bird.name && <span className="truncate text-xs text-muted">“{bird.name}”</span>}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {AGE_LABEL[bird.ageClass]} · {bird.ageYears.toFixed(1)} y{bird.sex ? ` · ${bird.sex === "male" ? "Male" : "Female"}` : ""}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${FIX_STATUS[status].color}18`, color: FIX_STATUS[status].color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: FIX_STATUS[status].color }} />
          {FIX_STATUS[status].label}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
        <Mini k="Zone" v={det?.zoneId ? MONITOR_ZONE_BY_ID[det.zoneId].code : "—"} />
        <Mini k="Tree" v={det?.treeId ?? (det?.kind === "zone" ? "zone" : "—")} />
        <Mini k="Height" v={fmtHeight(det?.pos?.y)} />
      </div>

      {/* Height within the aviary, with the level bands */}
      <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]" title={det?.pos ? `${det.pos.y.toFixed(1)} m` : "No height"}>
        {LEVELS.filter((l) => l.id !== "ground").map((l) => (
          <span key={l.id} className="absolute inset-y-0 border-l border-white" style={{ left: `${(Math.max(0, l.min) / 26) * 100}%` }} />
        ))}
        {det?.pos && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (det.pos.y / 26) * 100)}%`, background: color }} />}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1" title={DEVICE_STATUS_LABEL[bird.device.status]}>
          <BatteryMedium size={13} className={cx(battery <= 20 ? "text-danger" : "text-faint")} />
          {battery}% · {DEVICE_STATUS_LABEL[bird.device.status].toLowerCase()}
        </span>
        <span>{det ? fmtAgo(det.at, asOf) : "never"}</span>
      </div>
      <p className="mt-1.5 text-[10px] font-medium text-accent opacity-0 transition group-hover:opacity-100">View on Habitat map →</p>
    </Link>
  );
}

function Kpi({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line px-2.5 py-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="num text-base font-semibold leading-none text-ink">{value}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted">{label}</p>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-faint">{k}</dt>
      <dd className="mt-0.5 text-ink">{v}</dd>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-ink/[0.035] px-1.5 py-1">
      <p className="text-[9px] uppercase tracking-wide text-faint">{k}</p>
      <p className="num text-xs font-semibold text-ink">{v}</p>
    </div>
  );
}
