"use client";

import Link from "next/link";
import { ArrowUpRight, Clock, MapPin, MapPinned, MessageSquareText, Scale, Users } from "lucide-react";
import { ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES_BY_ID } from "@/domain/species";
import type { HealthCase } from "@/domain/types";
import { STATUS_LABEL } from "@/logic/status";
import { DAY, fmtAgo, fmtDateTime } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { Badge, Drawer, cx } from "@/components/ui/primitives";
import { PenguinIllustration } from "@/components/penguin/PenguinIllustration";
import { askChat } from "@/features/chat/ask";
import { CaseCard, InsightBadge, REASON_LABEL } from "./HealthCards";

/** Lo que se muestra de un caso sin abrirlo: quién lo sigue, dónde está el pingüino y cómo va. */
function useCaseFacts(hc: HealthCase) {
  const { dataset, penguinById, snapshots, insights, teamOf, now } = useDemo();
  const p = penguinById.get(hc.penguinId);
  const team = dataset.teams.find((t) => t.id === teamOf(hc.penguinId));
  const snap = snapshots.get(hc.penguinId);
  const r = snap?.reading;
  const ins = insights.get(hc.penguinId);
  const weights = hc.entries.filter((e) => e.weightKg !== undefined);
  const lastW = weights[0]?.weightKg;
  const firstW = weights[weights.length - 1]?.weightKg;
  const days = Math.max(1, Math.round(((hc.closedAt ?? now) - hc.openedAt) / DAY));
  return { p, team, snap, r, ins, lastW, firstW, days, now };
}

/** Tarjeta resumida de un caso; al picarla se abre el seguimiento completo. */
export function CaseSummary({ hc, onOpen }: { hc: HealthCase; onOpen: () => void }) {
  const { p, team, snap, r, ins, lastW, firstW, days, now } = useCaseFacts(hc);
  if (!p) return null;
  const sp = SPECIES_BY_ID[p.speciesId];
  const open = hc.status === "open";
  const last = hc.entries[0];

  return (
    <button
      onClick={onOpen}
      className={cx(
        "group flex w-full flex-col rounded-xl border p-4 text-left transition hover:border-accent/50 hover:shadow-[0_6px_18px_rgba(11,36,64,0.08)]",
        open ? "border-line-strong bg-panel-solid" : "border-line bg-ink/[0.02]",
      )}
    >
      <div className="flex items-start gap-3">
        <PenguinIllustration speciesId={p.speciesId} size={44} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-sm font-semibold text-ink">{p.id}</span>
            {p.name && <span className="text-sm text-ink">{p.name}</span>}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: sp.color }} />
            {sp.nameEs}
          </p>
        </div>
        <Badge tone={open ? "accent" : "neutral"}>{open ? "En seguimiento" : "Cerrado"}</Badge>
      </div>

      <p className="mt-3 text-sm font-semibold text-ink">{hc.title}</p>
      <p className="text-[11px] text-muted">
        {REASON_LABEL[hc.reason]} · {open ? `abierto hace ${days} ${days === 1 ? "día" : "días"}` : `cerrado tras ${days} días`}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-faint">
            <Users size={11} /> Le da seguimiento
          </dt>
          <dd className="flex items-center gap-1.5 truncate text-ink">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: team?.color ?? "var(--muted)" }} />
            {team?.name ?? "Sin equipo"}
          </dd>
          <dd className="truncate text-muted">{hc.owner}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-faint">
            <MapPin size={11} /> Dónde está
          </dt>
          <dd className="truncate text-ink">{r ? ZONE_BY_ID[r.zoneId]?.name : "Sin ubicación"}</dd>
          <dd className="truncate text-muted">{snap ? `${STATUS_LABEL[snap.status]}${r ? ` · ${fmtAgo(r.timestamp, now)}` : ""}` : "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-faint">¿Cómo va?</dt>
          <dd className="mt-0.5">{ins ? <InsightBadge level={ins.level} /> : "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-faint">
            <Scale size={11} /> Peso
          </dt>
          <dd className="text-ink">
            {lastW !== undefined ? `${lastW.toFixed(2)} kg` : "Sin pesaje"}
            {lastW !== undefined && firstW !== undefined && firstW !== lastW && (
              <span className={cx("num ml-1", lastW > firstW ? "text-ok" : "text-warn")}>
                ({lastW > firstW ? "+" : ""}
                {(lastW - firstW).toFixed(2)})
              </span>
            )}
          </dd>
        </div>
      </dl>

      {last && (
        <p className="mt-3 line-clamp-2 rounded-lg bg-ink/[0.03] px-2.5 py-1.5 text-[11px] text-muted">
          <span className="text-faint">
            <Clock size={10} className="mr-1 inline" />
            {fmtAgo(last.at, now)}:
          </span>{" "}
          {last.text}
        </p>
      )}
      <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-accent opacity-80 group-hover:opacity-100">
        Ver seguimiento <ArrowUpRight size={12} />
      </span>
    </button>
  );
}

/** Panel lateral con todo el seguimiento del caso. */
export function CaseDrawer({ hc, onClose }: { hc: HealthCase | null; onClose: () => void }) {
  return (
    <Drawer open={!!hc} onClose={onClose} width={520} title="Seguimiento de salud">
      {hc && <CaseDetail hc={hc} />}
    </Drawer>
  );
}

function CaseDetail({ hc }: { hc: HealthCase }) {
  const { p, team, snap, r, ins, days, now } = useCaseFacts(hc);
  if (!p) return null;
  const sp = SPECIES_BY_ID[p.speciesId];
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-line/60 py-2 text-xs last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right text-ink">{v}</span>
    </div>
  );

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center gap-4">
        <PenguinIllustration speciesId={p.speciesId} size={72} />
        <div className="min-w-0">
          <p className="font-mono text-lg font-semibold">{p.id}</p>
          {p.name && <p className="text-sm text-ink">{p.name}</p>}
          <p className="text-xs text-muted">
            {sp.nameEs} · {sp.nameEn}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/penguins/${p.id}#salud`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-xs text-ink hover:border-accent/50">
          Ver ficha <ArrowUpRight size={12} />
        </Link>
        <Link href={`/map?penguin=${p.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-xs text-ink hover:border-accent/50">
          <MapPinned size={13} /> Ver en el mapa
        </Link>
        <button
          onClick={() => askChat(`Dame el reporte completo de ${p.id}: cómo va, qué cambió y qué conviene vigilar.`)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-xs text-ink hover:border-accent/50"
        >
          <MessageSquareText size={13} /> Pedir reporte
        </button>
      </div>

      <div className="rounded-xl border border-line px-3">
        {row("Le da seguimiento", (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: team?.color ?? "var(--muted)" }} />
            {team?.name ?? "Sin equipo"}
          </span>
        ))}
        {row("Líder del equipo", team?.lead ?? "—")}
        {row("Responsable del caso", hc.owner)}
        {row("Integrantes", team?.members.join(", ") ?? "—")}
        {row("Dónde está", r ? `${ZONE_BY_ID[r.zoneId]?.name} · ${snap ? STATUS_LABEL[snap.status] : ""}` : "Sin ubicación")}
        {row("Última lectura", r ? `${fmtDateTime(r.timestamp, now)} (${fmtAgo(r.timestamp, now)})` : "—")}
        {row("¿Cómo va?", ins ? <InsightBadge level={ins.level} /> : "—")}
        {row("Motivo", REASON_LABEL[hc.reason])}
        {row(hc.status === "open" ? "Abierto" : "Duración", hc.status === "open" ? `${fmtDateTime(hc.openedAt, now)} · hace ${days} ${days === 1 ? "día" : "días"}` : `${days} días`)}
      </div>

      {ins && ins.points.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Lo que muestran sus datos</p>
          <ul className="space-y-1.5">
            {ins.points.map((pt, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted">
                <span className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", pt.level === "ok" ? "bg-ok" : pt.level === "watch" ? "bg-warn" : "bg-danger")} />
                {pt.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="eyebrow mb-2">Bitácora del seguimiento</p>
        <CaseCard hc={hc} expandedByDefault />
      </div>
    </div>
  );
}
