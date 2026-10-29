"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClipboardList, TreePine } from "lucide-react";
import { GROUP_LABEL, MONITOR_ZONE_BY_ID, type AgeClass } from "@/domain/aviaryTracking";
import { DEMO_TOTAL_BIRDS, REQUESTED_TOTAL } from "@/data/aviaryCatalog";
import { SPECIES_INFO } from "@/data/aviarySpeciesInfo";
import { runDemoChecks } from "@/logic/aviaryDemoChecks";
import { treeOccupants } from "@/logic/aviaryTracking";
import { Card, cx } from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/AppShell";
import { ChecksCard } from "./monitor/AviaryParts";
import { AviaryFrame, useAviarySnapshot } from "./common";

const AGES: AgeClass[] = ["juvenile", "subadult", "adult", "senior"];

/** Species catalogue with demo counts, the tree inventory and the data checks. */
export function AviaryInventory() {
  const { registry, ds, src, fixes, origin } = useAviarySnapshot();
  const checks = useMemo(() => runDemoChecks(ds, src, fixes, origin), [ds, src, fixes, origin]);

  const rows = useMemo(
    () =>
      registry.species.map((s) => {
        const birds = registry.birds.filter((b) => b.speciesId === s.id);
        return {
          s,
          n: birds.length,
          male: birds.filter((b) => b.sex === "male").length,
          female: birds.filter((b) => b.sex === "female").length,
          ages: AGES.map((a) => birds.filter((b) => b.ageClass === a).length),
        };
      }),
    [registry],
  );
  const total = rows.reduce((a, r) => a + r.n, 0);

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Aviary · Demo catalogue" title="Species" subtitle={`${registry.species.length} species · ${total} birds · ${registry.trees.length} trees. Generated once and stored in this browser.`} />
      <AviaryFrame banner="This distribution exists only for the demo and does not represent the population of any zoological facility.">
        {registry.distributionNote && (
          <p className="rounded-xl border border-accent-2/30 bg-accent-2/[0.05] px-4 py-2.5 text-xs text-ink">
            <span className="font-semibold">Total checked before loading.</span> {registry.distributionNote}
          </p>
        )}

        <Card title="Species catalogue" icon={ClipboardList} subtitle={`Requested ${REQUESTED_TOTAL} · generated ${total} (target ${DEMO_TOTAL_BIRDS})`}>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[920px] text-xs">
              <caption className="sr-only">Demo species catalogue with counts</caption>
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted">
                  <th scope="col" className="px-2 py-2 font-medium">Code</th>
                  <th scope="col" className="px-2 py-2 font-medium">Species</th>
                  <th scope="col" className="px-2 py-2 font-medium">Group</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Requested</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Demo birds</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">M / F</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Juv · Sub · Adult · Senior</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, n, male, female, ages }) => (
                  <tr key={s.id} className="border-b border-line/60">
                    <td className="px-2 py-1.5">
                      <span className="inline-grid h-6 w-10 place-items-center rounded-md text-[10px] font-bold text-white" style={{ background: s.color }}>{s.code}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <Link href={`/aviary/species/${s.id}`} className="group flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={SPECIES_INFO[s.code].photo.src} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                        <span className="min-w-0">
                          <span className="font-medium text-ink group-hover:text-accent">{s.common}</span>
                          <span className="block text-[11px] text-muted">
                            <i>{s.scientific}</i> · {s.commonEs}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 text-muted">{GROUP_LABEL[s.group]}</td>
                    <td className={cx("num px-2 py-1.5 text-right", s.requestedCount !== n ? "text-warn" : "text-muted")}>{s.requestedCount}</td>
                    <td className="num px-2 py-1.5 text-right font-semibold text-ink">{n}</td>
                    <td className="num px-2 py-1.5 text-right text-muted">{s.dimorphic ? `${male} / ${female}` : "not recorded"}</td>
                    <td className="num px-2 py-1.5 text-right text-muted">{ages.join(" · ")}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="px-2 py-2" colSpan={3}>Total</td>
                  <td className="num px-2 py-2 text-right">{REQUESTED_TOTAL}</td>
                  <td className="num px-2 py-2 text-right">{total}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-faint">Open a species to see its photo, summary and every bird. Sex is recorded only for species where males and females look different; juveniles of those species are not sexed yet.</p>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <Card title="Trees" icon={TreePine} subtitle="Demo trees on the conceptual layout. Reference points are simulated, not surveyed.">
            <div className="scroll-thin max-h-[520px] overflow-auto">
              <table className="w-full min-w-[620px] text-xs">
                <caption className="sr-only">Demo tree inventory</caption>
                <thead className="sticky top-0 bg-panel-solid">
                  <tr className="border-b border-line text-left text-[11px] text-muted">
                    {["Tree", "Zone", "Form", "Height", "X · Y", "Reference points", "Birds now"].map((h) => (
                      <th key={h} scope="col" className="px-2 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registry.trees.map((t) => (
                    <tr key={t.id} className="border-b border-line/60">
                      <td className="px-2 py-1.5 font-semibold text-ink">{t.id}</td>
                      <td className="px-2 py-1.5 text-muted">{MONITOR_ZONE_BY_ID[t.zoneId].code} · {MONITOR_ZONE_BY_ID[t.zoneId].name}</td>
                      <td className="px-2 py-1.5 capitalize text-muted">{t.form}</td>
                      <td className="num px-2 py-1.5 text-ink">{t.heightM.toFixed(1)} m</td>
                      <td className="num px-2 py-1.5 text-muted">{t.x.toFixed(1)} · {t.z.toFixed(1)}</td>
                      <td className="num px-2 py-1.5 text-muted">{t.branchTiersM.map((h, i) => `R${i + 1} ${h.toFixed(1)}`).join(" · ")}</td>
                      <td className="num px-2 py-1.5 text-right font-semibold text-ink">{treeOccupants(fixes, t.id).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <ChecksCard checks={checks} />
        </div>
      </AviaryFrame>
    </div>
  );
}
