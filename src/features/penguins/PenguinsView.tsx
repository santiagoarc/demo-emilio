"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDownUp, ArrowUpRight, Search, Bird } from "lucide-react";
import { ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES_BY_ID } from "@/domain/species";
import { STATUS_LABEL, type LiveStatus } from "@/logic/status";
import { QUALITY_LABEL, SOURCE_SHORT } from "@/logic/labels";
import { fmtAgo, fmtDateTime } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { PageHeader } from "@/components/shell/AppShell";
import { GlobalFilters } from "@/components/filters/GlobalFilters";
import { EmptyState, Select } from "@/components/ui/primitives";
import { PenguinIllustration } from "@/components/penguin/PenguinIllustration";
import { StatusPill } from "@/components/penguin/StatusPill";

type SortKey = "id" | "updated" | "status";
/** Statuses offered for filtering and sorting. */
const SHOWN_STATUSES: LiveStatus[] = ["water", "land", "resting"];

export function PenguinsView() {
  const { dataset, visible, snapshots, teamOf, now } = useDemo();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<LiveStatus | "">("");
  const [sort, setSort] = useState<SortKey>("id");
  const router = useRouter();

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = visible
      .map((p) => ({ p, snap: snapshots.get(p.id)! }))
      .filter(({ p, snap }) => (!status || snap.status === status) && (!s || [p.id, p.name ?? "", p.deviceId].some((v) => v.toLowerCase().includes(s))));
    const rank = (st: LiveStatus) => (SHOWN_STATUSES.includes(st) ? SHOWN_STATUSES.indexOf(st) : SHOWN_STATUSES.length);
    list.sort((a, b) =>
      sort === "id"
        ? a.p.id.localeCompare(b.p.id)
        : sort === "updated"
          ? (b.snap.reading?.timestamp ?? 0) - (a.snap.reading?.timestamp ?? 0)
          : rank(a.snap.status) - rank(b.snap.status),
    );
    return list;
  }, [visible, snapshots, q, status, sort]);

  return (
    <div className="pb-10">
      <PageHeader eyebrow="Registry" title="Penguins" subtitle="Every penguin in the scenario. Open any of them to see its individual profile." />
      <div className="space-y-5 px-6 lg:px-8">
        <div className="panel-flat p-4">
          <GlobalFilters showRange={false} />
        </div>
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line-strong bg-panel-solid px-3">
              <Search size={14} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by ID, name or device" className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
            </div>
            <Select value={status} onChange={(e) => setStatus(e.target.value as LiveStatus | "")} aria-label="Status">
              <option value="">All statuses</option>
              {SHOWN_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
              <option value="id">Sort by ID</option>
              <option value="updated">Sort by last reading</option>
              <option value="status">Sort by status</option>
            </Select>
            <span className="num ml-auto inline-flex items-center gap-1 text-xs text-muted">
              <ArrowDownUp size={12} /> {rows.length} {rows.length === 1 ? "penguin" : "penguins"}
            </span>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={Bird} title="No penguins match these filters" />
          ) : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
                    <th className="px-4 py-2.5 font-medium">Penguin</th>
                    <th className="px-4 py-2.5 font-medium">Species</th>
                    <th className="px-4 py-2.5 font-medium">Team</th>
                    <th className="px-4 py-2.5 font-medium">Last recorded zone</th>
                    <th className="px-4 py-2.5 font-medium">Last reading</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 250).map(({ p, snap }) => {
                    const sp = SPECIES_BY_ID[p.speciesId];
                    const team = dataset.teams.find((t) => t.id === teamOf(p.id))!;
                    return (
                      <tr
                        key={p.id}
                        role="link"
                        tabIndex={0}
                        onClick={() => router.push(`/penguins/${p.id}`)}
                        onKeyDown={(e) => e.key === "Enter" && router.push(`/penguins/${p.id}`)}
                        className="cursor-pointer border-t border-line transition hover:bg-accent/[0.06] focus-visible:bg-accent/[0.08] focus-visible:outline-none"
                      >
                        <td className="px-4 py-2">
                          <Link href={`/penguins/${p.id}`} className="flex items-center gap-2.5">
                            <PenguinIllustration speciesId={p.speciesId} size={30} />
                            <span>
                              <span className="block font-mono font-medium">{p.id}</span>
                              <span className="block text-[11px] text-muted">{p.name ?? "Unnamed"}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-muted">
                          <Link href={`/species/${sp.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-ink hover:underline">{sp.nameEn}</Link>
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 text-muted">
                            <span className="h-2 w-2 rounded-full" style={{ background: team.color }} />
                            {team.name}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted">{snap.reading ? ZONE_BY_ID[snap.reading.zoneId].name : "—"}</td>
                        <td
                          className="num px-4 py-2 text-xs text-muted"
                          title={snap.reading ? `${fmtDateTime(snap.reading.timestamp, now)} · ${SOURCE_SHORT[snap.reading.source]} · ${QUALITY_LABEL[snap.reading.quality]} quality (±${snap.reading.accuracyM} m)` : undefined}
                        >
                          {snap.reading ? (
                            <>
                              {fmtAgo(snap.reading.timestamp, now)}
                              <span className="block text-[10px] text-faint">{SOURCE_SHORT[snap.reading.source]} · ±{snap.reading.accuracyM} m</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2"><StatusPill status={snap.status} compact /></td>
                        <td className="px-4 py-2 text-right">
                          <Link href={`/penguins/${p.id}`} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                            Profile <ArrowUpRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
