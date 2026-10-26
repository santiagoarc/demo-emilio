"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { SPECIES_BY_ID } from "@/domain/species";
import { useDemo } from "@/state/DemoProvider";
import { StatusPill } from "@/components/penguin/StatusPill";
import { cx } from "@/components/ui/primitives";

export function PenguinSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <SearchDialog onClose={onClose} />;
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const { dataset, snapshots, teamOf } = useDemo();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return dataset.penguins
      .filter((p) => {
        if (!s) return true;
        const sp = SPECIES_BY_ID[p.speciesId];
        const team = dataset.teams.find((t) => t.id === teamOf(p.id))?.name ?? "";
        return [p.id, p.name ?? "", p.deviceId, sp.nameEs, sp.nameEn, team].some((v) => v.toLowerCase().includes(s));
      })
      .slice(0, 40);
  }, [q, dataset, teamOf]);

  const go = (id: string) => {
    router.push(`/penguins/${id}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="fade-up w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-panel-solid shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setIdx((i) => Math.min(i + 1, results.length - 1));
              if (e.key === "ArrowUp") setIdx((i) => Math.max(i - 1, 0));
              if (e.key === "Enter" && results[idx]) go(results[idx].id);
            }}
            placeholder="ID, nombre, dispositivo, especie o equipo…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </div>
        <ul className="scroll-thin max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Sin coincidencias.</li>}
          {results.map((p, i) => {
            const sp = SPECIES_BY_ID[p.speciesId];
            const snap = snapshots.get(p.id)!;
            return (
              <li key={p.id}>
                <button
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => go(p.id)}
                  className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left", i === idx && "bg-ink/[0.05]")}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: sp.color }} />
                  <span className="num w-20 font-mono text-[13px]">{p.id}</span>
                  <span className="flex-1 truncate text-xs text-muted">
                    {p.name ? <span className="text-ink">{p.name} · </span> : null}
                    {sp.nameEs} · {dataset.teams.find((t) => t.id === teamOf(p.id))?.name}
                  </span>
                  <StatusPill status={snap.status} compact />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
