"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, Battery, Radio, X } from "lucide-react";
import { ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES_BY_ID } from "@/domain/species";
import { SOURCE_SHORT, QUALITY_LABEL, QUALITY_TONE } from "@/logic/labels";
import { computeActivity } from "@/logic/metrics";
import { snapshotAt } from "@/logic/status";
import { fmtAgo, fmtDateTime, fmtHours, HOUR, startOfDay } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { Badge, SimulatedTag, cx } from "@/components/ui/primitives";
import { SERIES, SplitBar } from "@/components/charts/Charts";
import { PenguinIllustration } from "./PenguinIllustration";
import { StatusPill } from "./StatusPill";
import { MovementHistory } from "./MovementHistory";
import { TeamReassign } from "./TeamReassign";

/** Panel lateral del mapa: lo esencial de un ejemplar sin salir del mapa. */
export function PenguinPanel({ penguinId, at, onClose, className }: { penguinId: string; at: number; onClose: () => void; className?: string }) {
  const { dataset, penguinById, deviceById, config, now } = useDemo();
  const p = penguinById.get(penguinId);
  const snap = useMemo(() => (p ? snapshotAt(dataset, deviceById, config.rules, p, at) : null), [p, dataset, deviceById, config.rules, at]);
  const today = useMemo(() => computeActivity(dataset, [penguinId], startOfDay(at), at + 1), [dataset, penguinId, at]);
  if (!p || !snap) return null;

  const sp = SPECIES_BY_ID[p.speciesId];
  const r = snap.reading;
  const zone = r ? ZONE_BY_ID[r.zoneId] : null;
  const lastKnown = snap.status === "stale" || snap.status === "offline";
  const t = today.totals;

  return (
    <aside className={cx("slide-in panel flex h-full w-[380px] max-w-[92vw] flex-col overflow-hidden !rounded-2xl", className)}>
      <div className="relative border-b border-line p-5">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ink" aria-label="Cerrar panel">
          <X size={16} />
        </button>
        <div className="flex items-center gap-4">
          <PenguinIllustration speciesId={p.speciesId} size={76} />
          <div className="min-w-0">
            <p className="font-mono text-xl font-semibold tracking-tight">{p.id}</p>
            {p.name && <p className="text-sm text-muted">{p.name}</p>}
            <p className="text-sm text-ink">{sp.nameEs}</p>
            <p className="text-xs text-muted">{sp.nameEn}</p>
            <div className="mt-2">
              <StatusPill status={snap.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-5">
        <div>
          <p className="eyebrow mb-2">Equipo responsable</p>
          <TeamReassign key={penguinId} penguinId={penguinId} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={lastKnown ? "Última zona conocida" : "Zona actual registrada"}>
            {zone ? zone.name : "—"}
          </Field>
          <Field label={lastKnown ? "Última ubicación conocida" : "Última actualización"}>
            {r ? (
              <>
                {fmtDateTime(r.timestamp, now)}
                <span className={`block text-[11px] ${lastKnown ? "text-warn" : "text-faint"}`}>{fmtAgo(r.timestamp, at)}</span>
              </>
            ) : (
              "Sin lecturas"
            )}
          </Field>
          <Field label="Fuente de la lectura">
            {r ? SOURCE_SHORT[r.source] : "—"}
            {r && <span className="block text-[11px] text-faint">±{r.accuracyM} m</span>}
          </Field>
          <Field label="Calidad">
            {r ? <Badge tone={QUALITY_TONE[r.quality]}>{QUALITY_LABEL[r.quality]}</Badge> : "—"}
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted">
            <Radio size={13} /> {snap.device.id}
          </span>
          <span className={snap.status === "offline" ? "text-danger" : "text-muted"}>
            {snap.status === "offline" ? `Sin latido ${fmtAgo(snap.device.lastHeartbeat, at)}` : `Latido ${fmtAgo(Math.min(snap.device.lastHeartbeat, at), at)}`}
          </span>
          <span className="inline-flex items-center gap-1 text-muted">
            <Battery size={13} /> {snap.device.batteryPct}%
          </span>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Tiempo registrado hoy</p>
            <SimulatedTag />
          </div>
          <SplitBar
            parts={[
              { value: t.water, color: SERIES.water, label: "Agua" },
              { value: t.land, color: SERIES.land, label: "Tierra" },
              { value: t.noFix, color: SERIES.noFix, label: "Sin posición" },
              { value: t.noComm, color: SERIES.noComm, label: "Sin comunicación" },
            ]}
          />
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <p className="text-muted">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: SERIES.water }} />
              Agua <span className="num ml-1 font-semibold text-ink">{fmtHours(t.water)}</span>
            </p>
            <p className="text-muted">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: SERIES.land }} />
              Tierra <span className="num ml-1 font-semibold text-ink">{fmtHours(t.land)}</span>
            </p>
            {t.noFix + t.noComm > 0 && (
              <p className="col-span-2 text-[11px] text-faint">
                {fmtHours(t.noFix + t.noComm)} sin lectura: no se reparte entre agua y tierra.
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="eyebrow mb-2">Movimientos recientes</p>
          <MovementHistory penguinId={penguinId} from={at - 12 * HOUR} to={at + 1} limit={8} />
        </div>
      </div>

      <div className="border-t border-line p-4">
        <Link
          href={`/penguins/${p.id}`}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-[#032a2a] transition hover:bg-[#5fe6d9]"
        >
          Abrir ficha individual <ArrowUpRight size={15} />
        </Link>
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-white/[0.02] px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <div className="mt-0.5 text-sm text-ink">{children}</div>
    </div>
  );
}
