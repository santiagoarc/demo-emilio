"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronRight, MapPinned, Search, X } from "lucide-react";
import { FIX_STATUS, GROUP_LABEL } from "@/domain/aviaryTracking";
import { SPECIES_INFO } from "@/data/aviarySpeciesInfo";
import { runDemoChecks } from "@/logic/aviaryDemoChecks";
import type { Fix } from "@/logic/aviaryTracking";
import { cx } from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/AppShell";
import { ChecksCard } from "./monitor/AviaryParts";
import { SpeciesRow, lastPlace, monitorState } from "./AviaryPanels";
import { AviaryFrame, useAviarySnapshot } from "./common";

/**
 * Species: a compact list to find a species fast. Picking one shows its birds,
 * with a way to the map filtered by it and to each bird's profile.
 */
export function AviaryInventory() {
  const { registry, ds, src, fixes, origin } = useAviarySnapshot();
  const checks = useMemo(() => runDemoChecks(ds, src, fixes, origin), [ds, src, fixes, origin]);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(registry.species[0]?.id ?? "");

  const bySpecies = useMemo(() => {
    const m = new Map<string, Fix[]>();
    for (const f of fixes.values()) {
      const list = m.get(f.bird.speciesId);
      if (list) list.push(f);
      else m.set(f.bird.speciesId, [f]);
    }
    return m;
  }, [fixes]);
  const t = q.trim().toLowerCase();
  const list = registry.species.filter((s) => !t || `${s.common} ${s.commonEs} ${s.scientific} ${s.code}`.toLowerCase().includes(t));
  const sp = registry.species.find((s) => s.id === picked) ?? null;
  const birds = sp ? bySpecies.get(sp.id) ?? [] : [];
  const st = monitorState(birds);

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Aviary · Species" title="Species" subtitle={`${registry.species.length} species · ${registry.birds.length} birds. Pick one to see its birds.`} />
      <AviaryFrame>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <section className="panel flex h-[calc(100vh-190px)] min-h-[460px] flex-col overflow-hidden" aria-label="Species list">
            <div className="border-b border-line p-3">
              <label className="relative block">
                <span className="sr-only">Search a species</span>
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name or code…"
                  className="h-9 w-full rounded-xl border border-line-strong bg-panel-solid pl-8 pr-7 text-xs text-ink outline-none placeholder:text-faint focus:border-accent/60"
                />
                {q && (
                  <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink" aria-label="Clear search">
                    <X size={13} />
                  </button>
                )}
              </label>
            </div>
            <ul className="scroll-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
              {list.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted">No species matches “{q}”.</li>}
              {list.map((s) => (
                <li key={s.id}>
                  <SpeciesRow species={s} birds={bySpecies.get(s.id) ?? []} selected={picked === s.id} onClick={() => setPicked(s.id)} size="lg" />
                </li>
              ))}
            </ul>
          </section>

          {sp && (
            <section className="panel flex h-[calc(100vh-190px)] min-h-[460px] flex-col overflow-hidden" aria-label={sp.common}>
              <div className="flex gap-4 border-b border-line p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SPECIES_INFO[sp.code].photo.src} alt={sp.common} className="h-24 w-32 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: sp.color }} />
                    <span className="text-lg font-semibold text-ink">{sp.common}</span>
                  </p>
                  <p className="text-xs text-muted">
                    <i>{sp.scientific}</i> · {GROUP_LABEL[sp.group]}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span>
                      <b className="num text-base text-ink">{birds.length}</b> <span className="text-muted">birds</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: st.color }} /> {st.label}
                    </span>
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Link href={`/aviary/map?species=${sp.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-white hover:bg-[#0b8178]">
                      <MapPinned size={13} /> View on map
                    </Link>
                    <Link href={`/aviary/species/${sp.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs text-ink hover:border-accent/50">
                      Species page <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
              <p className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-faint">Individuals</p>
              <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                {birds.map((f) => (
                  <li key={f.bird.id}>
                    <Link
                      href={`/aviary/birds/${f.bird.id}`}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-ink/[0.04] hover:shadow-[0_2px_8px_rgba(11,36,64,0.06)]"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: FIX_STATUS[f.status].color }} title={FIX_STATUS[f.status].label} />
                      <span className="w-20 font-mono text-xs font-semibold text-ink">{f.bird.id}</span>
                      <span className="w-20 truncate text-xs text-muted">{f.bird.name ?? ""}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted">{lastPlace(f)}</span>
                      <span className="hidden text-[11px] text-faint sm:inline">{FIX_STATUS[f.status].label}</span>
                      <ChevronRight size={14} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <details className="group">
          <summary className={cx("cursor-pointer list-none text-xs text-muted hover:text-ink")}>Data checks and reset ›</summary>
          <div className="mt-3 max-w-xl">
            <ChecksCard checks={checks} />
          </div>
        </details>
      </AviaryFrame>
    </div>
  );
}
