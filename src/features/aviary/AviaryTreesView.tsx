"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, TreePine } from "lucide-react";
import { LEVELS, MONITOR_ZONES, MONITOR_ZONE_BY_ID } from "@/domain/aviaryTracking";
import { MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { treeOccupants } from "@/logic/aviaryTracking";
import { fmtTime } from "@/logic/time";
import { Card, Select } from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/AppShell";
import { AviaryFrame, useAviarySnapshot } from "./common";
import { SpeciesAvatar } from "./SpeciesAvatar";

/** Every demo tree with the birds located in it now; a row opens the tree on the map. */
export function AviaryTreesView() {
  const { registry, fixes, asOf } = useAviarySnapshot();
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("");
  const rows = useMemo(
    () =>
      registry.trees
        .filter((t) => (!zone || t.zoneId === zone) && (!q || `${t.id} ${t.plantSpecies ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())))
        .map((t) => {
          const occ = treeOccupants(fixes, t.id);
          return { t, occ, species: [...new Set(occ.map((f) => f.bird.speciesId))], last: occ.reduce((m, f) => Math.max(m, f.det!.at), 0) };
        }),
    [registry, fixes, q, zone],
  );
  const located = rows.reduce((a, r) => a + r.occ.length, 0);

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Aviary · Trees" title="Trees" subtitle={`${registry.trees.length} trees with their working IDs. Birds located in each one at ${fmtTime(asOf)}.`} />
      <AviaryFrame>
        <Card title="Tree list" icon={TreePine} subtitle={`${rows.length} trees · ${located} birds located in them`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Search a tree</span>
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tree ID or plant name…" className="h-9 w-full rounded-xl border border-line-strong bg-panel-solid pl-8 pr-3 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/60" />
            </label>
            <Select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone">
              <option value="">All zones</option>
              {MONITOR_ZONES.map((z) => (
                <option key={z.id} value={z.id}>{z.code} · {z.name}</option>
              ))}
            </Select>
          </div>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs">
              <caption className="sr-only">Trees and the birds located in them</caption>
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted">
                  {["Tree", "Zone", "Height", ...LEVELS.slice().reverse().map((l) => l.short), "Birds", "Species", "Last detection", ""].map((h, i) => (
                    <th key={`${h}-${i}`} scope="col" className="px-2 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ t, occ, species, last }) => (
                  <tr key={t.id} className="border-b border-line/60 hover:bg-ink/[0.025]">
                    <td className="px-2 py-1.5">
                      <span className="font-semibold text-ink">{t.id}</span>
                      <span className="block text-[11px] text-muted">{t.plantSpecies} · {t.form}</span>
                    </td>
                    <td className="px-2 py-1.5 text-muted">{MONITOR_ZONE_BY_ID[t.zoneId].code} · {MONITOR_ZONE_BY_ID[t.zoneId].name}</td>
                    <td className="num px-2 py-1.5 text-ink">{t.heightM.toFixed(1)} m</td>
                    {LEVELS.slice()
                      .reverse()
                      .map((l) => (
                        <td key={l.id} className="num px-2 py-1.5 text-center text-muted">{l.id !== "ground" && l.min >= t.heightM ? "—" : occ.filter((f) => f.levelId === l.id).length}</td>
                      ))}
                    <td className="num px-2 py-1.5 font-semibold text-ink">{occ.length}</td>
                    <td className="px-2 py-1.5">
                      <span className="flex -space-x-1.5">
                        {species.slice(0, 6).map((sid) => (
                          <SpeciesAvatar key={sid} code={MONITOR_SPECIES_BY_ID[sid].code} size={20} title={MONITOR_SPECIES_BY_ID[sid].common} />
                        ))}
                        {species.length > 6 && <span className="pl-2.5 text-[10px] text-muted">+{species.length - 6}</span>}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-muted">{last ? fmtTime(last) : "—"}</td>
                    <td className="px-2 py-1.5 text-right">
                      <Link href={`/aviary/map?tree=${t.id}`} className="text-accent hover:underline">Open on map →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-faint">Level columns count birds located in the tree at each height band (provisional ranges); “—” means the tree does not reach that level.</p>
        </Card>
      </AviaryFrame>
    </div>
  );
}
