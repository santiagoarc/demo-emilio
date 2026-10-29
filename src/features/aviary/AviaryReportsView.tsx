"use client";

import { useMemo } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { AGE_LABEL, DEVICE_STATUS_LABEL, FIX_STATUS, LEVEL_BY_ID, MONITOR_ZONE_BY_ID } from "@/domain/aviaryTracking";
import { MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { MONITOR_TEAMS, MONITOR_TEAM_BY_ID } from "@/data/aviaryTeams";
import { runDemoChecks } from "@/logic/aviaryDemoChecks";
import { treeOccupants } from "@/logic/aviaryTracking";
import { fmtDateTime } from "@/logic/time";
import { useTeamAssignments } from "@/state/useTeams";
import { Card } from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/AppShell";
import { ChecksCard } from "./monitor/AviaryParts";
import { monitorState } from "./AviaryPanels";
import { AviaryFrame, useAviarySnapshot } from "./common";

type Cell = string | number;

/** Builds a CSV in the browser and hands it to the user; nothing is sent anywhere. */
function download(name: string, head: string[], rows: Cell[][]) {
  const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Downloadable tables of the demo data, plus the data checks. */
export function AviaryReportsView() {
  const { registry, ds, src, fixes, asOf, origin } = useAviarySnapshot();
  const { teamOf } = useTeamAssignments(registry);
  const checks = useMemo(() => runDemoChecks(ds, src, fixes, origin), [ds, src, fixes, origin]);
  const stamp = new Date(asOf).toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const all = [...fixes.values()];

  const reports = [
    {
      id: "birds",
      title: "Birds and last location",
      detail: `${registry.birds.length} rows · ID, species, team, age, sex, device, zone, tree, height, level, status, confidence`,
      run: () =>
        download(
          `aviary-birds-DEMO-${stamp}.csv`,
          ["ID", "Species", "Scientific name", "Team", "Age class", "Age (y)", "Sex", "Device", "Device status", "Zone", "Tree", "Height (m)", "Level", "Status", "Last detection", "Location confidence"],
          all.map((f) => {
            const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
            const d = f.det;
            return [
              f.bird.id, sp.common, sp.scientific, MONITOR_TEAM_BY_ID[teamOf(f.bird)].name, AGE_LABEL[f.bird.ageClass], f.bird.ageYears, f.bird.sex ?? "",
              f.bird.device.id, DEVICE_STATUS_LABEL[f.bird.device.status], d?.zoneId ? MONITOR_ZONE_BY_ID[d.zoneId].name : "", d?.treeId ?? "",
              d?.pos ? d.pos.y.toFixed(1) : "", f.levelId ? LEVEL_BY_ID[f.levelId].short : "", FIX_STATUS[f.status].label, d ? new Date(d.at).toISOString() : "", d ? Math.round(d.confidence * 100) + "%" : "",
            ];
          }),
        ),
    },
    {
      id: "teams",
      title: "Teams summary",
      detail: `${MONITOR_TEAMS.length} rows · birds, species, detected and without signal per team`,
      run: () =>
        download(
          `aviary-teams-DEMO-${stamp}.csv`,
          ["Team", "Lead", "Birds", "Species", "Detected", "No signal", "Status"],
          MONITOR_TEAMS.map((t) => {
            const birds = all.filter((f) => teamOf(f.bird) === t.id);
            const st = monitorState(birds);
            return [t.name, t.lead, birds.length, new Set(birds.map((f) => f.bird.speciesId)).size, st.detected, st.noSignal, st.noSignal ? "Check" : "OK"];
          }),
        ),
    },
    {
      id: "trees",
      title: "Trees and their birds",
      detail: `${registry.trees.length} rows · tree, plant name, zone, height, birds and species now`,
      run: () =>
        download(
          `aviary-trees-DEMO-${stamp}.csv`,
          ["Tree", "Plant name (demo)", "Zone", "Height (m)", "Birds now", "Species now", "Bird IDs"],
          registry.trees.map((t) => {
            const occ = treeOccupants(fixes, t.id);
            return [t.id, t.plantSpecies ?? "", MONITOR_ZONE_BY_ID[t.zoneId].name, t.heightM, occ.length, new Set(occ.map((f) => f.bird.speciesId)).size, occ.map((f) => f.bird.id).join(" ")];
          }),
        ),
    },
  ];

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Aviary · Reports" title="Reports" subtitle={`Tables of the demo data at the saved simulated time, ${fmtDateTime(asOf, asOf)}. Files are built in this browser and marked DEMO.`} />
      <AviaryFrame banner="Every figure in these files is fictional demo data.">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card title="Downloads" icon={FileSpreadsheet}>
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{r.title}</p>
                    <p className="text-[11px] text-muted">{r.detail}</p>
                  </div>
                  <button onClick={r.run} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs font-medium text-ink hover:border-accent/50">
                    <Download size={13} /> CSV
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <ChecksCard checks={checks} />
        </div>
      </AviaryFrame>
    </div>
  );
}
