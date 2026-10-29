"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronRight, MapPinned, Search, TreePine } from "lucide-react";
import { FIX_STATUS, LEVELS, MONITOR_ZONES, MONITOR_ZONE_BY_ID, levelOf, type AviaryTree } from "@/domain/aviaryTracking";
import { MONITOR_SPECIES_BY_ID } from "@/data/aviaryCatalog";
import { TREE_PHOTO } from "@/data/aviaryTreePhotos";
import { fmtHeight, treeHistory, treeOccupants } from "@/logic/aviaryTracking";
import { DAY, HOUR, MIN, fmtAgo, fmtHours, fmtTime } from "@/logic/time";
import { Badge, Card, Modal, Select, cx } from "@/components/ui/primitives";
import { BarList } from "@/components/charts/Charts";
import { PageHeader } from "@/components/shell/AppShell";
import { BirdInsightBlock } from "./monitor/BirdActivity";
import { AviaryFrame, useAviarySnapshot } from "./common";
import { SpeciesAvatar } from "./SpeciesAvatar";

const FORM_LABEL = { emergent: "Emergent tree", broadleaf: "Broadleaf tree", palm: "Palm" } as const;

/** The tree inventory; picking a tree opens its card in a popup, without leaving the page. */
export function AviaryTreesView() {
  const { registry, fixes, asOf } = useAviarySnapshot();
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      registry.trees
        .filter((t) => (!zone || t.zoneId === zone) && (!q || t.id.toLowerCase().includes(q.trim().toLowerCase())))
        .map((t) => {
          const occ = treeOccupants(fixes, t.id);
          return { t, occ, species: [...new Set(occ.map((f) => f.bird.speciesId))], last: occ.reduce((m, f) => Math.max(m, f.det!.at), 0) };
        }),
    [registry, fixes, q, zone],
  );
  const located = rows.reduce((a, r) => a + r.occ.length, 0);
  const tree = openId ? registry.trees.find((t) => t.id === openId) ?? null : null;

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Aviary · Trees" title="Trees" subtitle={`${registry.trees.length} trees with their working IDs. Birds located in each one at ${fmtTime(asOf)}. Click a tree to see its card.`} />
      <AviaryFrame>
        <Card title="Tree inventory" icon={TreePine} subtitle={`${rows.length} trees · ${located} birds located in them`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Search a tree</span>
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tree ID…" className="h-9 w-full rounded-xl border border-line-strong bg-panel-solid pl-8 pr-3 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/60" />
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
                  <tr
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(t.id)}
                    onKeyDown={(e) => e.key === "Enter" && setOpenId(t.id)}
                    className="group cursor-pointer border-b border-line/60 transition hover:bg-accent/[0.06] focus-visible:bg-accent/[0.08] focus-visible:outline-none"
                  >
                    <td className="px-2 py-1.5">
                      <span className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={TREE_PHOTO[t.form].src} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                        <span>
                          <span className="font-semibold text-ink">{t.id}</span>
                          <span className="block text-[11px] text-muted">{FORM_LABEL[t.form]}</span>
                        </span>
                      </span>
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
                      <ChevronRight size={15} className="ml-auto text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-faint">Level columns count birds located in the tree at each height band (provisional ranges); “—” means the tree does not reach that level.</p>
        </Card>
      </AviaryFrame>

      <Modal open={!!tree} onClose={() => setOpenId(null)} width={720} title={tree ? `Tree ${tree.id}` : ""}>
        {tree && <TreePopup key={tree.id} tree={tree} />}
      </Modal>
    </div>
  );
}

/** A tree's card. Opening a bird shows its summary in the same popup, with a way back. */
function TreePopup({ tree }: { tree: AviaryTree }) {
  const { ds, src, fixes, asOf, birdById } = useAviarySnapshot();
  const [birdId, setBirdId] = useState<string | null>(null);
  const occ = useMemo(() => treeOccupants(fixes, tree.id), [fixes, tree.id]);
  const from = asOf - DAY;
  const visits = useMemo(() => treeHistory(ds, src, tree.id, from, asOf), [ds, src, tree.id, from, asOf]);
  const stay = visits.reduce((a, v) => a + (Math.min(v.end, asOf) - Math.max(v.start, from)), 0);
  const visitors = new Set(visits.map((v) => v.birdId)).size;
  const reached = LEVELS.filter((l) => l.id === "ground" || l.min < tree.heightM);
  const byLevel = reached.map((l) => ({ key: l.id, label: l.label, value: visits.filter((v) => levelOf(v.heightM).id === l.id).length, color: "#16a34a" }));
  const photo = TREE_PHOTO[tree.form];
  const zone = MONITOR_ZONE_BY_ID[tree.zoneId];

  if (birdId) {
    const fix = fixes.get(birdId)!;
    const bird = birdById.get(birdId)!;
    const sp = MONITOR_SPECIES_BY_ID[bird.speciesId];
    return (
      <div className="space-y-4 p-5">
        <button onClick={() => setBirdId(null)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10">
          <ArrowLeft size={14} /> Back to tree {tree.id}
        </button>
        <div className="flex items-start gap-4">
          <SpeciesAvatar code={sp.code} size={64} ring={sp.color} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-lg font-semibold">{bird.id}</p>
            <p className="text-sm text-ink">{sp.common} <i className="text-xs text-muted">{sp.scientific}</i></p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: FIX_STATUS[fix.status].color }} />
              {FIX_STATUS[fix.status].label} · {fix.det?.treeId ?? "—"} · {fmtHeight(fix.det?.pos?.y)} · {fix.det ? fmtAgo(fix.det.at, asOf) : "never"}
            </p>
          </div>
        </div>
        <BirdInsightBlock bird={bird} asOf={asOf} />
        <div className="flex flex-wrap gap-2">
          <Link href={`/aviary/birds/${bird.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white hover:bg-[#0b8178]">
            Open individual profile <ArrowUpRight size={14} />
          </Link>
          <Link href={`/aviary/map?bird=${bird.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm text-ink hover:border-accent/50">
            <MapPinned size={14} /> View on map
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <figure className="relative h-56 overflow-hidden bg-ink/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.src} alt={`${photo.label}, reference photo`} className="h-full w-full object-cover" />
        <a href={photo.page} target="_blank" rel="noreferrer" className="absolute bottom-2 left-2 rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-muted hover:text-ink" title={`${photo.author} · ${photo.license}`}>
          Reference photo of a {photo.label.toLowerCase()} · not this tree · {photo.author}, {photo.license}
        </a>
      </figure>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold text-ink">{tree.id}</p>
            <p className="text-xs text-muted">{FORM_LABEL[tree.form]} · {zone.code} {zone.name}</p>
          </div>
          <Link href={`/aviary/map?tree=${tree.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-xs text-ink hover:border-accent/50">
            <MapPinned size={13} /> View on map
          </Link>
        </div>

        <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs sm:grid-cols-3">
          <Fact k="Tree ID" v={<span className="font-mono">{tree.id}</span>} />
          <Fact k="Plant species" v={<span className="text-muted">Not registered</span>} />
          <Fact k="Total height" v={`${tree.heightM.toFixed(1)} m`} />
          <Fact k="Aviary zone" v={`${zone.code} · ${zone.name}`} />
          <Fact k="Height levels" v={reached.map((l) => l.short).join(" · ")} />
          <Fact k="Record status" v={<Badge tone="info">Working ID · not surveyed</Badge>} />
        </dl>

        <section>
          <p className="eyebrow mb-2">Birds detected in this tree now ({occ.length})</p>
          {occ.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-center text-xs text-muted">No bird is located in this tree right now.</p>
          ) : (
            <ul className="space-y-0.5">
              {occ.map((f) => {
                const sp = MONITOR_SPECIES_BY_ID[f.bird.speciesId];
                return (
                  <li key={f.bird.id}>
                    <button onClick={() => setBirdId(f.bird.id)} className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-ink/[0.045] hover:shadow-[0_2px_8px_rgba(11,36,64,0.08)]">
                      <SpeciesAvatar code={sp.code} size={28} ring={sp.color} />
                      <span className="w-[74px] font-mono text-xs font-semibold text-ink">{f.bird.id}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted">{sp.common}</span>
                      <span className="num w-14 text-right text-xs text-ink">{fmtHeight(f.det?.pos?.y)}</span>
                      <span className="num w-12 text-right text-[11px] text-muted">{f.det ? fmtTime(f.det.at) : "—"}</span>
                      <span className="w-16 text-right text-[11px] text-faint">{f.det ? fmtAgo(f.det.at, asOf) : "—"}</span>
                      <span className={cx("inline-flex w-[92px] items-center justify-end gap-1 text-[11px]", f.status === "no-signal" ? "text-danger" : "text-muted")}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: FIX_STATUS[f.status].color }} /> {FIX_STATUS[f.status].label}
                      </span>
                      <ChevronRight size={14} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <p className="eyebrow mb-2">Activity · last 24 h</p>
          {visits.length === 0 ? (
            <p className="text-xs text-muted">Not enough data: no bird stayed in this tree in the last 24 h.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <dl className="grid grid-cols-3 gap-3 text-xs">
                  <Fact k="Time recorded" v={stay >= HOUR ? fmtHours(stay) : `${Math.round(stay / MIN)} min`} />
                  <Fact k="Visits" v={String(visits.length)} />
                  <Fact k="Different birds" v={String(visitors)} />
                </dl>
                <p className="mb-1.5 mt-4 text-[11px] text-muted">Visits by height level</p>
                <BarList items={byLevel} format={(v) => String(v)} />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] text-muted">Latest visits</p>
                <ol className="scroll-thin max-h-56 space-y-0.5 overflow-y-auto pr-1">
                  {visits.slice(0, 30).map((v) => {
                    const sp = MONITOR_SPECIES_BY_ID[birdById.get(v.birdId)!.speciesId];
                    return (
                      <li key={v.id}>
                        <button onClick={() => setBirdId(v.birdId)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-ink/[0.04]">
                          <span className="num w-[78px] shrink-0 text-muted">{fmtTime(v.start)}–{fmtTime(Math.min(v.end, asOf))}</span>
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sp.color }} />
                          <span className="font-mono text-ink">{v.birdId}</span>
                          <span className="ml-auto text-muted">{v.heightM.toFixed(1)} m</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          )}
        </section>
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
