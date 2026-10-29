"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { AGE_LABEL, FIX_STATUS, LEVELS, MONITOR_ZONES, MONITOR_ZONE_BY_ID, type FixStatus, type LevelId } from "@/domain/aviaryTracking";
import { MONITOR_SPECIES, MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { fmtHeight } from "@/logic/aviaryTracking";
import { fmtAgo, fmtDateTime } from "@/logic/time";
import { Select } from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/AppShell";
import { AviaryFrame, useAviarySnapshot } from "./common";

const PAGE = 100;

/** All 500 demo birds in one searchable table. A row opens the bird in the monitor. */
export function BirdRegistry() {
  const { registry, fixes, asOf } = useAviarySnapshot();
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
      <PageHeader eyebrow="Aviary · Demo registry" title="Birds" subtitle={`${registry.birds.length} individual birds across ${registry.species.length} species. Positions as of the simulated clock, ${fmtDateTime(asOf, asOf)}.`} />
      <AviaryFrame banner="Open a bird to see it on the Habitat map with its card and detection history.">
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
            <table className="w-full min-w-[980px] text-xs">
              <caption className="sr-only">Demo bird registry</caption>
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted">
                  {["ID", "Species", "Age", "Sex", "Zone", "Tree", "Height", "Level", "Status", "Device", "Last detection"].map((h) => (
                    <th key={h} scope="col" className="px-2 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((f) => {
                  const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
                  const d = f.det;
                  return (
                    <tr key={f.bird.id} className="border-b border-line/60 hover:bg-ink/[0.025]">
                      <td className="px-2 py-1.5">
                        <Link href={`/aviary/map?bird=${f.bird.id}`} className="font-mono font-semibold text-ink hover:text-accent">{f.bird.id}</Link>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sp.color }} />
                          <span className="text-ink">{sp.common}</span>
                        </span>
                        <span className="block pl-3.5 text-[11px] italic text-muted">{sp.scientific}</span>
                      </td>
                      <td className="px-2 py-1.5 text-muted">{AGE_LABEL[f.bird.ageClass]} · {f.bird.ageYears.toFixed(1)} y</td>
                      <td className="px-2 py-1.5 text-muted">{f.bird.sex ? (f.bird.sex === "male" ? "M" : "F") : "—"}</td>
                      <td className="px-2 py-1.5 text-muted">{d?.zoneId ? MONITOR_ZONE_BY_ID[d.zoneId].code : "—"}</td>
                      <td className="px-2 py-1.5 text-ink">{d?.treeId ?? "—"}</td>
                      <td className="num px-2 py-1.5 text-ink">{fmtHeight(d?.pos?.y)}</td>
                      <td className="px-2 py-1.5 text-muted">{f.levelId ? LEVELS.find((l) => l.id === f.levelId)!.short : d?.kind === "zone" ? "Zone only" : "—"}</td>
                      <td className="px-2 py-1.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: FIX_STATUS[f.status].color }} />
                          {FIX_STATUS[f.status].label}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-muted">{f.bird.device.status.replace("-", " ")}</td>
                      <td className="px-2 py-1.5 text-muted">{d ? fmtAgo(d.at, asOf) : "never"}</td>
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
