"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRightLeft,
  Battery,
  BellRing,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Droplets,
  History,
  ListOrdered,
  MapPin,
  MapPinned,
  Mountain,
  NotebookPen,
  Radio,
  SearchX,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES_BY_ID } from "@/domain/species";
import type { LocationReading } from "@/domain/types";
import { ALERT_TYPE_LABEL } from "@/logic/alertRules";
import { ALERT_STATUS_LABEL, PRIORITY_LABEL, PRIORITY_TONE, QUALITY_LABEL, QUALITY_TONE, RECORD_STATUS_LABEL, SOURCE_LABEL, SOURCE_SHORT, TASK_KIND_LABEL, TASK_STATUS_LABEL } from "@/logic/labels";
import { computeActivity } from "@/logic/metrics";
import { firstIndexAtOrAfter, lastIndexAtOrBefore } from "@/logic/status";
import { DAY, HOUR, MIN, fmtAgo, fmtDate, fmtDateTime, fmtHours, fmtWeekday, fromDateInput, startOfDay, toDateInput } from "@/logic/time";
import { PERMISSIONS, useDemo } from "@/state/DemoProvider";
import { Badge, Button, Card, EmptyState, SimulatedTag, cx } from "@/components/ui/primitives";
import { SERIES, SplitBar, StackedColumns } from "@/components/charts/Charts";
import { HabitatMap, type TrailPoint } from "@/components/map/HabitatMap";
import { PeriodPicker } from "@/components/filters/PeriodPicker";
import { PenguinIllustration } from "@/components/penguin/PenguinIllustration";
import { StatusPill } from "@/components/penguin/StatusPill";
import { MovementHistory } from "@/components/penguin/MovementHistory";
import { TeamReassign } from "@/components/penguin/TeamReassign";
import { TaskStatusControl } from "@/features/alerts/TaskStatusControl";
import { isOpenTask } from "@/logic/tasks";

const PROFILE_LABEL = { stable: "Comunicación estable", intermittent: "Comunicación intermitente", offline: "Sin comunicación" } as const;

const SECTIONS = [
  { id: "resumen", label: "Resumen" },
  { id: "localizacion", label: "Localización" },
  { id: "actividad", label: "Actividad" },
  { id: "lecturas", label: "Lecturas" },
  { id: "equipo", label: "Equipo" },
  { id: "cuidado", label: "Cuidado" },
  { id: "alertas", label: "Alertas" },
  { id: "historial", label: "Historial" },
];

export function PenguinProfileView() {
  const { id } = useParams<{ id: string }>();
  const { penguinById } = useDemo();
  const p = penguinById.get(decodeURIComponent(id ?? ""));
  if (!p) {
    return (
      <div className="p-8">
        <Card>
          <EmptyState icon={SearchX} title={`No existe el ejemplar ${id}`} action={<Link href="/penguins" className="text-sm text-accent hover:underline">Ir al registro</Link>}>
            Puede que el escenario se haya regenerado con otra cantidad de ejemplares.
          </EmptyState>
        </Card>
      </div>
    );
  }
  return <Profile key={p.id} penguinId={p.id} />;
}

function Profile({ penguinId }: { penguinId: string }) {
  const { dataset, penguinById, snapshots, teamOf, alerts, range, now } = useDemo();
  const p = penguinById.get(penguinId)!;
  const sp = SPECIES_BY_ID[p.speciesId];
  const snap = snapshots.get(penguinId)!;
  const team = dataset.teams.find((t) => t.id === teamOf(penguinId));
  const { from, to } = range;

  const agg = useMemo(() => computeActivity(dataset, [penguinId], from, to), [dataset, penguinId, from, to]);
  const r = snap.reading;
  const lastKnown = snap.status === "stale" || snap.status === "offline";
  const openAlerts = alerts.filter((a) => a.penguinId === penguinId && a.status !== "resolved");
  const t = agg.totals;
  const title = p.name ?? p.id;

  return (
    <div className="pb-10">
      {/* 1. Encabezado */}
      <div className="px-6 pt-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted">
          <Link href="/species" className="hover:text-ink">Species</Link>
          <ChevronRight size={12} className="text-faint" />
          <Link href={`/species/${sp.id}`} className="hover:text-ink">{sp.nameEs}</Link>
          <ChevronRight size={12} className="text-faint" />
          <span className="text-ink">{title}</span>
        </nav>
      </div>

      <div id="resumen" className="mx-6 mt-3 scroll-mt-20 lg:mx-8">
        <div className="panel relative overflow-hidden p-5">
          <div className="absolute inset-y-0 right-0 w-2/3 opacity-[0.07]" style={{ background: `radial-gradient(circle at 85% 30%, ${sp.color}, transparent 65%)` }} />
          <div className="relative flex flex-wrap items-start gap-5">
            <figure className="shrink-0">
              <PenguinIllustration speciesId={p.speciesId} size={116} />
              <figcaption className="mt-1 max-w-[116px] text-center text-[10px] leading-tight text-faint">Imagen representativa de la especie</figcaption>
            </figure>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Ficha individual</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <h1 className="text-[30px] font-semibold leading-tight tracking-tight">{p.name ?? <span className="text-muted">Sin nombre registrado</span>}</h1>
                <span className="font-mono text-lg text-muted">{p.id}</span>
              </div>
              <p className="mt-1 text-sm">
                {sp.nameEs} <span className="text-muted">· {sp.nameEn} ·</span> <i className="text-muted">{sp.scientific}</i>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill status={snap.status} />
                <Badge tone={p.recordStatus === "active" ? "ok" : p.recordStatus === "recent" ? "info" : "warn"}>{RECORD_STATUS_LABEL[p.recordStatus]}</Badge>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: team?.color ?? "#56718a" }} /> {team?.name ?? "Sin asignar"}
                </span>
                <span className={cx("inline-flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px]", lastKnown ? "text-warn" : "text-muted")}>
                  <MapPin size={11} />
                  {r ? `${ZONE_BY_ID[r.zoneId].name} · ${fmtDateTime(r.timestamp, now)}` : "Sin ubicación registrada"}
                  {lastKnown && " · desactualizada"}
                </span>
                <SimulatedTag />
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap justify-end gap-2">
                <Link href={`/species/${sp.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm text-ink hover:border-accent/50">
                  <ArrowLeft size={14} /> Listado de la especie
                </Link>
                <Link href={`/map?penguin=${p.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-[#032a2a] hover:bg-[#5fe6d9]">
                  <MapPinned size={15} /> Ver en el mapa
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-faint">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={12} /> {PERMISSIONS.role}
                </span>
                {PERMISSIONS.reassignTeam && (
                  <a href="#equipo" className="rounded-md border border-line px-1.5 py-0.5 text-muted hover:text-ink">Reasignar equipo</a>
                )}
                {PERMISSIONS.addObservation && (
                  <a href="#cuidado" className="rounded-md border border-line px-1.5 py-0.5 text-muted hover:text-ink">Registrar observación</a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación entre secciones */}
      <div className="sticky top-0 z-20 mt-4 border-y border-line bg-bg/85 px-6 backdrop-blur lg:px-8">
        <div className="scroll-thin flex items-center gap-1 overflow-x-auto py-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-muted hover:bg-white/5 hover:text-ink">
              {s.label}
            </a>
          ))}
          <span className="ml-auto pl-3">
            <PeriodPicker />
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-5 px-6 lg:px-8">
        {/* 2. Indicadores */}
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Kpi label={lastKnown ? "Última ubicación conocida" : "Última ubicación"} value={r ? ZONE_BY_ID[r.zoneId].name : "Sin datos"} sub={r ? (lastKnown ? "Desactualizada" : "Reciente") : undefined} warn={lastKnown} small />
          <Kpi label="Tiempo en agua" value={t.readings ? fmtHours(t.water) : "Sin datos"} sub={range.label} color={SERIES.water} />
          <Kpi label="Tiempo en tierra" value={t.readings ? fmtHours(t.land) : "Sin datos"} sub={range.label} color="#f5b84b" />
          <Kpi label="Sin lectura" value={fmtHours(t.noFix + t.noComm)} sub={range.label} color="#56718a" />
          <Kpi label="Última lectura" value={r ? fmtDateTime(r.timestamp, now) : "Sin datos"} sub={r ? fmtAgo(r.timestamp, now) : undefined} warn={lastKnown} small />
          <Kpi label="Alertas activas" value={String(openAlerts.length)} sub={openAlerts.length ? "Ver sección Alertas" : "Ninguna"} warn={openAlerts.length > 0} />
        </div>

        <LocationSection penguinId={penguinId} />
        <ActivitySection penguinId={penguinId} />
        <ReadingsSection penguinId={penguinId} />

        <div className="grid gap-5 xl:grid-cols-12">
          <TeamSection penguinId={penguinId} className="xl:col-span-5" />
          <CareSection penguinId={penguinId} className="xl:col-span-7" />
        </div>

        <div className="grid gap-5 xl:grid-cols-12">
          <AlertsSection penguinId={penguinId} className="xl:col-span-5" />
          <TimelineSection penguinId={penguinId} className="xl:col-span-7" />
        </div>
      </div>
    </div>
  );
}

/* ───────────── 3. Localización ───────────── */

function LocationSection({ penguinId }: { penguinId: string }) {
  const { dataset, penguinById, snapshots, range, now } = useDemo();
  const p = penguinById.get(penguinId)!;
  const sp = SPECIES_BY_ID[p.speciesId];
  const snap = snapshots.get(penguinId)!;
  const r = snap.reading;
  const lastKnown = snap.status === "stale" || snap.status === "offline";

  const trail: TrailPoint[] = useMemo(() => {
    const list = dataset.readings.get(penguinId) ?? [];
    const out: TrailPoint[] = [];
    for (let i = lastIndexAtOrBefore(list, now); i >= 0 && list[i].timestamp > now - 24 * HOUR; i--) {
      const q = list[i];
      out.push({ x: q.x, y: q.y, t: q.timestamp, quality: q.quality, medium: q.medium });
    }
    return out.reverse();
  }, [dataset, penguinId, now]);

  const trailFocus = useMemo(() => {
    if (!trail.length) return null;
    const xs = trail.map((q) => q.x), ys = trail.map((q) => q.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = Math.min(1600, Math.max((maxX - minX) * 1.5, (maxY - minY) * 1.5 * 1.6, 560));
    return { key: 1, x: (minX + maxX) / 2, y: (minY + maxY) / 2, w };
  }, [trail]);

  return (
    <Card
      title={<span id="localizacion" className="scroll-mt-20">Localización e historial de movimientos</span>}
      icon={MapPinned}
      subtitle="Recorrido de las últimas 24 h. Cada punto es una lectura registrada; las líneas solo unen lecturas consecutivas, no son un trayecto medido."
      action={
        <Link href={`/map?penguin=${p.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line-strong px-2.5 text-xs text-ink hover:border-accent/50">
          <MapPinned size={13} /> Ver en Habitat Map
        </Link>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_280px_300px]">
        <div className="aspect-[16/10] overflow-hidden rounded-xl border border-line bg-black/20">
          {r ? (
            <HabitatMap
              markers={[{ id: p.id, x: r.x, y: r.y, color: sp.color, status: snap.status, medium: r.medium, accuracyM: r.accuracyM }]}
              selectedId={p.id}
              trail={trail}
              focus={trailFocus}
              layers={{ zones: true, labels: true, landmarks: false, markers: true, lastKnown: true, restricted: true, trail: true }}
            />
          ) : (
            <EmptyState icon={MapPinned} title="Sin lecturas de ubicación" />
          )}
        </div>
        <dl className="space-y-2.5 text-sm">
          <Row k={lastKnown ? "Última zona conocida" : "Última zona registrada"} v={r ? ZONE_BY_ID[r.zoneId].name : "Sin datos"} />
          <Row k="Fecha y hora" v={r ? <span className={lastKnown ? "text-warn" : ""}>{fmtDateTime(r.timestamp, now)} · {fmtAgo(r.timestamp, now)}</span> : "Sin datos"} />
          <Row k="Fuente" v={r ? SOURCE_LABEL[r.source] : "Sin datos"} />
          <Row k="Calidad / precisión" v={r ? <><Badge tone={QUALITY_TONE[r.quality]}>{QUALITY_LABEL[r.quality]}</Badge> <span className="text-[11px] text-faint">±{r.accuracyM} m</span></> : "Sin datos"} />
          <Row k="Estado de actualización" v={<StatusPill status={snap.status} compact />} />
          <Row
            k="Dispositivo"
            v={
              <span className={snap.device.profile === "offline" ? "text-danger" : snap.device.profile === "intermittent" ? "text-warn" : ""}>
                <span className="font-mono">{p.deviceId}</span>
                <span className="block text-[11px]">
                  <Radio size={11} className="mr-1 inline" />
                  {PROFILE_LABEL[snap.device.profile]}
                </span>
                <span className="block text-[11px] text-faint">
                  Último latido {fmtAgo(snap.device.lastHeartbeat, now)} · <Battery size={11} className="inline" /> {snap.device.batteryPct}%
                </span>
              </span>
            }
          />
          {lastKnown && (
            <p className="rounded-lg border border-warn/30 bg-warn/10 px-2.5 py-2 text-[11px] text-warn">
              {snap.status === "offline" ? "El dispositivo no comunica." : "El dispositivo comunica pero no hay posición reciente."} La zona mostrada es la última conocida, no una posición actual.
            </p>
          )}
        </dl>
        <div>
          <p className="mb-2 text-xs font-medium">Cambios entre zonas · {range.label.toLowerCase()}</p>
          <div className="scroll-thin max-h-[330px] overflow-y-auto pr-1">
            <MovementHistory penguinId={penguinId} from={range.from} to={range.to} limit={40} />
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ───────────── 4. Actividad ───────────── */

function ActivitySection({ penguinId }: { penguinId: string }) {
  const { dataset, range } = useDemo();
  const { from, to } = range;
  const agg = useMemo(() => computeActivity(dataset, [penguinId], from, to), [dataset, penguinId, from, to]);
  const span = to - from;
  const prev = useMemo(
    () => (from - span >= dataset.windowStart ? computeActivity(dataset, [penguinId], from - span, from).totals : null),
    [dataset, penguinId, from, span],
  );
  const changes = useMemo(() => {
    const recs = (dataset.activity.get(penguinId) ?? []).filter((x) => x.start >= from && x.start < to);
    let n = 0;
    for (let i = 1; i < recs.length; i++) if (recs[i].medium !== recs[i - 1].medium) n++;
    return n;
  }, [dataset, penguinId, from, to]);
  const t = agg.totals;
  const days = span / DAY;

  return (
    <Card
      title={<span id="actividad" className="scroll-mt-20">Actividad</span>}
      icon={Activity}
      subtitle={`${range.label} · horas registradas por las lecturas. Lo que no tiene lectura se muestra aparte.`}
      action={<SimulatedTag />}
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBlock label="En agua · observado" value={t.readings ? fmtHours(t.water) : "Sin datos"} sub="Sensor de inmersión del dispositivo (simulado)" color={SERIES.water} />
        <MetricBlock label="En tierra · observado" value={t.readings ? fmtHours(t.land) : "Sin datos"} sub={`Incluye ${fmtHours(t.stationary)} sin movimiento registrado (inferido)`} color={SERIES.land} />
        <MetricBlock label="Sin lectura · sin datos" value={fmtHours(t.noFix + t.noComm)} sub={`${fmtHours(t.noFix)} sin posición · ${fmtHours(t.noComm)} sin comunicación`} color={SERIES.noFix} />
        <MetricBlock label="Cambios agua ↔ tierra" value={String(changes)} sub="Entre tramos consecutivos sin hueco" color="#a78bfa" />
      </div>
      <SplitBar
        className="mt-4"
        parts={[
          { value: t.water, color: SERIES.water, label: "Agua" },
          { value: t.land, color: SERIES.land, label: "Tierra" },
          { value: t.noFix, color: SERIES.noFix, label: "Sin posición" },
          { value: t.noComm, color: SERIES.noComm, label: "Sin comunicación" },
        ]}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-xs text-muted">Distribución por hora del día · horas registradas</p>
          <StackedColumns
            height={140}
            labelEvery={6}
            format={fmtHours}
            series={[
              { key: "water", color: SERIES.water, label: "Agua" },
              { key: "land", color: SERIES.land, label: "Tierra" },
              { key: "gap", color: SERIES.noFix, label: "Sin lectura" },
            ]}
            data={agg.hourly.map((h, i) => ({ label: `${i}h`, tooltip: `${String(i).padStart(2, "0")}:00`, values: { water: h.water, land: h.land, gap: h.noFix + h.noComm } }))}
          />
        </div>
        <div>
          <p className="mb-3 text-xs text-muted">Comparación por día · horas registradas</p>
          <StackedColumns
            height={140}
            labelEvery={days > 8 ? 2 : 1}
            format={fmtHours}
            series={[
              { key: "water", color: SERIES.water, label: "Agua" },
              { key: "land", color: SERIES.land, label: "Tierra" },
              { key: "gap", color: SERIES.noFix, label: "Sin lectura" },
            ]}
            data={agg.daily.map((d) => ({ label: fmtDate(d.day).split(" ")[0], tooltip: fmtWeekday(d.day), values: { water: d.water, land: d.land, gap: d.noFix + d.noComm } }))}
          />
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-line p-4">
        <p className="mb-2 text-xs font-medium">Comparación con el periodo anterior de igual duración</p>
        {prev ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Compare label="Agua" cur={t.water} prev={prev.water} />
            <Compare label="Tierra" cur={t.land} prev={prev.land} />
            <Compare label="Sin lectura" cur={t.noFix + t.noComm} prev={prev.noFix + prev.noComm} />
          </div>
        ) : (
          <p className="text-xs text-muted">Sin datos suficientes: el escenario no guarda un periodo anterior completo.</p>
        )}
        <p className="mt-2 text-[11px] text-faint">
          Observado: lo indica una lectura. Inferido: «sin movimiento» se deduce de posiciones repetidas. Sin datos: no hubo lectura. Una diferencia de actividad no implica por sí misma ningún estado de salud.
        </p>
      </div>
    </Card>
  );
}

/* ───────────── 5. Historial de lecturas ───────────── */

type ReadingFlag = "repeated" | "low" | "after_gap" | "last_known";
const FLAG_LABEL: Record<ReadingFlag, string> = {
  repeated: "Posición repetida",
  low: "Precisión baja",
  after_gap: "Tras hueco",
  last_known: "Última conocida",
};

function ReadingsSection({ penguinId }: { penguinId: string }) {
  const { dataset, penguinById, snapshots, range, now } = useDemo();
  const p = penguinById.get(penguinId)!;
  const snap = snapshots.get(penguinId)!;
  const slot = dataset.slotMinutes * MIN;
  const [fromDay, setFromDay] = useState(toDateInput(range.from));
  const [toDay, setToDay] = useState(toDateInput(now));
  const [newest, setNewest] = useState(true);
  const [limit, setLimit] = useState(25);

  const rows = useMemo(() => {
    const list = dataset.readings.get(penguinId) ?? [];
    const a = Math.max(fromDateInput(fromDay), dataset.windowStart);
    const b = fromDateInput(toDay) + DAY;
    const lastIdx = lastIndexAtOrBefore(list, now);
    const out: { r: LocationReading; flags: ReadingFlag[]; gapMin: number }[] = [];
    for (let i = firstIndexAtOrAfter(list, a); i < list.length && list[i].timestamp < b && list[i].timestamp <= now; i++) {
      const r = list[i];
      const prev = list[i - 1];
      const flags: ReadingFlag[] = [];
      const gapMin = prev ? (r.timestamp - prev.timestamp) / MIN : 0;
      if (prev && prev.x === r.x && prev.y === r.y && r.timestamp - prev.timestamp <= slot) flags.push("repeated");
      if (r.quality === "low") flags.push("low");
      if (prev && r.timestamp - prev.timestamp > slot) flags.push("after_gap");
      if (i === lastIdx && (snap.status === "stale" || snap.status === "offline")) flags.push("last_known");
      out.push({ r, flags, gapMin });
    }
    return newest ? out.reverse() : out;
  }, [dataset, penguinId, fromDay, toDay, newest, slot, now, snap.status]);

  const minDay = toDateInput(dataset.windowStart);
  const maxDay = toDateInput(now);

  return (
    <Card
      title={<span id="lecturas" className="scroll-mt-20">Historial de lecturas</span>}
      icon={ListOrdered}
      subtitle={`${rows.length} lecturas en el rango. No se inventan coordenadas: cada fila es una lectura registrada.`}
      action={
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-muted">
            Desde
            <input type="date" value={fromDay} min={minDay} max={toDay} onChange={(e) => (setFromDay(e.target.value || minDay), setLimit(25))} className="h-8 rounded-lg border border-line-strong bg-panel-solid px-2 text-xs text-ink [color-scheme:dark]" />
          </label>
          <label className="flex items-center gap-1.5 text-muted">
            Hasta
            <input type="date" value={toDay} min={fromDay} max={maxDay} onChange={(e) => (setToDay(e.target.value || maxDay), setLimit(25))} className="h-8 rounded-lg border border-line-strong bg-panel-solid px-2 text-xs text-ink [color-scheme:dark]" />
          </label>
          <Button size="sm" variant="outline" onClick={() => setNewest((v) => !v)}>
            {newest ? "Más reciente primero" : "Más antigua primero"}
          </Button>
        </div>
      }
    >
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-muted">
              <th className="py-2 pr-3 font-medium">Fecha y hora</th>
              <th className="py-2 pr-3 font-medium">Zona · posición</th>
              <th className="py-2 pr-3 font-medium">Estado de localización</th>
              <th className="py-2 pr-3 font-medium">Fuente</th>
              <th className="py-2 pr-3 font-medium">Calidad</th>
              <th className="py-2 pr-3 font-medium">Dispositivo</th>
              <th className="py-2 font-medium">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map(({ r, flags, gapMin }) => (
              <tr key={r.timestamp} className="border-b border-line/60 last:border-0">
                <td className="whitespace-nowrap py-2 pr-3 text-xs">{fmtDateTime(r.timestamp, now)}</td>
                <td className="py-2 pr-3 text-xs">
                  {ZONE_BY_ID[r.zoneId].name}
                  <span className="ml-1.5 font-mono text-[10px] text-faint">
                    ({(r.x / dataset.habitat.unitsPerMeter).toFixed(1)}, {(r.y / dataset.habitat.unitsPerMeter).toFixed(1)}) m
                  </span>
                </td>
                <td className="py-2 pr-3 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    {r.medium === "water" ? <Droplets size={12} color={SERIES.water} /> : <Mountain size={12} color={SERIES.land} />}
                    {r.medium === "water" ? "En agua" : "En tierra"}
                  </span>
                </td>
                <td className="py-2 pr-3 text-xs text-muted">{SOURCE_SHORT[r.source]}</td>
                <td className="py-2 pr-3 text-xs">
                  <Badge tone={QUALITY_TONE[r.quality]}>{QUALITY_LABEL[r.quality]}</Badge>
                  <span className="ml-1 text-[10px] text-faint">±{r.accuracyM} m</span>
                </td>
                <td className="py-2 pr-3 font-mono text-[11px] text-muted" title="El estado del dispositivo no llega en cada lectura">{p.deviceId}</td>
                <td className="py-2 text-[11px]">
                  {flags.length === 0 ? (
                    <span className="text-faint">–</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {flags.map((f) => (
                        <Badge key={f} tone={f === "repeated" ? "neutral" : "warn"}>
                          {FLAG_LABEL[f]}
                          {f === "after_gap" ? ` de ${Math.round(gapMin)} min` : ""}
                        </Badge>
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-6 text-center text-xs text-muted">Sin lecturas en este rango.</p>}
      </div>
      {rows.length > limit && (
        <button onClick={() => setLimit((l) => l + 50)} className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ChevronDown size={13} /> Mostrar más ({rows.length - limit} restantes)
        </button>
      )}
      <p className="mt-2 text-[10px] text-faint">El estado del dispositivo no viene en cada lectura; se muestra el actual en Localización. Lecturas simuladas.</p>
    </Card>
  );
}

/* ───────────── 6. Equipo ───────────── */

function TeamSection({ penguinId, className }: { penguinId: string; className?: string }) {
  const { dataset, penguinById, teamOf, tasks, log, now } = useDemo();
  const p = penguinById.get(penguinId)!;
  const team = dataset.teams.find((t) => t.id === teamOf(penguinId));
  const initial = dataset.teams.find((t) => t.id === p.initialTeamId);
  const changes = log.filter((l) => l.penguinId === penguinId && l.kind === "assignment").sort((a, b) => b.at - a.at);
  const pending = tasks.filter((t) => t.penguinId === penguinId && isOpenTask(t)).sort((a, b) => a.dueAt - b.dueAt);

  return (
    <Card className={className} title={<span id="equipo" className="scroll-mt-20">Equipo responsable</span>} icon={Users}>
      {team ? (
        <div className="rounded-xl border border-line p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${team.color}22`, color: team.color }}>
              <Users size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{team.name}</p>
              <p className="text-xs text-muted">{team.focus}</p>
            </div>
            <Link href={`/teams?team=${team.id}`} className="text-xs text-accent hover:underline">Ver perfil</Link>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Responsable" v={team.lead} />
            <Row k="Integrantes" v={team.members.length} />
            <Row k="Fecha de asignación" v={changes[0] ? fmtDateTime(changes[0].at, now) : <span className="text-faint">Sin datos (asignación inicial)</span>} />
          </dl>
        </div>
      ) : (
        <p className="text-sm text-warn">Sin asignar</p>
      )}

      {PERMISSIONS.reassignTeam ? (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] text-muted">Reasignar (actualiza tareas y alertas abiertas en toda la plataforma)</p>
          <TeamReassign key={penguinId} penguinId={penguinId} compact />
        </div>
      ) : (
        <p className="mt-4 text-[11px] text-faint">Tu perfil no permite reasignar ejemplares.</p>
      )}

      <div className="mt-5">
        <p className="eyebrow mb-2">Tareas pendientes</p>
        {pending.length === 0 ? (
          <p className="text-xs text-muted">Sin tareas pendientes.</p>
        ) : (
          <ul className="space-y-2">
            {pending.slice(0, 5).map((tk) => (
              <li key={tk.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{tk.title}</p>
                  <p className={cx("text-[11px]", tk.dueAt < now ? "text-danger" : "text-faint")}>
                    {TASK_KIND_LABEL[tk.kind]} · {tk.dueAt < now ? "vencida" : "vence"} {fmtDateTime(tk.dueAt, now)}
                  </p>
                </div>
                <TaskStatusControl task={tk} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <p className="eyebrow mb-2">Historial de asignaciones</p>
        <ol className="space-y-2 text-xs">
          {changes.map((c) => (
            <li key={c.id} className="flex gap-2">
              <ArrowRightLeft size={13} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <p>{c.text}</p>
                <p className="text-[11px] text-faint">{fmtDateTime(c.at, now)}</p>
              </div>
            </li>
          ))}
          <li className="flex gap-2">
            <Users size={13} className="mt-0.5 shrink-0 text-faint" />
            <div>
              <p>Asignación inicial: {initial?.name ?? "Sin datos"}</p>
              <p className="text-[11px] text-faint">Fecha sin registrar en el escenario</p>
            </div>
          </li>
        </ol>
      </div>
    </Card>
  );
}

/* ───────────── 7. Cuidado y observaciones ───────────── */

function CareSection({ penguinId, className }: { penguinId: string; className?: string }) {
  const { dataset, tasks, userNotes, log, lastReviewOf, config, addNote, now } = useDemo();
  const [text, setText] = useState("");
  const notes = [...userNotes, ...dataset.notes].filter((n) => n.penguinId === penguinId).sort((a, b) => b.at - a.at);
  const reviews = [
    ...dataset.incidents.filter((i) => i.penguinId === penguinId && i.kind === "care").map((i) => ({ id: i.id, at: i.at, text: i.text, by: "Equipo de cuidado" })),
    ...tasks
      .filter((t) => t.penguinId === penguinId && t.status === "done")
      .map((t) => {
        const last = t.history[t.history.length - 1];
        return { id: `done-${t.id}`, at: last?.at ?? t.dueAt, text: `${t.title} completada (${t.id}).`, by: last?.by ?? "Sin datos" };
      }),
  ].sort((a, b) => b.at - a.at);
  const upcoming = tasks.filter((t) => t.penguinId === penguinId && isOpenTask(t)).sort((a, b) => a.dueAt - b.dueAt);
  const routineDue = lastReviewOf(penguinId) + config.rules.careReviewIntervalDays * DAY;
  const incidents = [
    ...dataset.incidents.filter((i) => i.penguinId === penguinId && i.kind !== "care"),
    ...log.filter((l) => l.penguinId === penguinId && l.kind !== "assignment"),
  ].sort((a, b) => b.at - a.at);

  return (
    <Card className={className} title={<span id="cuidado" className="scroll-mt-20">Cuidado y observaciones</span>} icon={NotebookPen}>
      {PERMISSIONS.addObservation ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            addNote(penguinId, text.trim());
            setText("");
          }}
          className="mb-5 rounded-xl border border-line p-3"
        >
          <label className="text-[11px] text-muted" htmlFor="obs">Nueva observación operativa</label>
          <textarea
            id="obs"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Describe lo observado (sin diagnósticos)…"
            className="mt-1 w-full resize-none rounded-lg border border-line-strong bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent/60"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-faint">Se registra con tu usuario y la hora actual del escenario. Queda separada de los registros veterinarios.</p>
            <Button size="sm" variant="primary" type="submit" disabled={!text.trim()}>Registrar</Button>
          </div>
        </form>
      ) : (
        <p className="mb-4 text-[11px] text-faint">Tu perfil no permite registrar observaciones.</p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-2">Observaciones de cuidadores</p>
          {notes.length === 0 ? (
            <p className="text-xs text-muted">Sin datos.</p>
          ) : (
            <ul className="scroll-thin max-h-[260px] space-y-3 overflow-y-auto pr-1">
              {notes.map((n) => (
                <li key={n.id} className={cx("border-l-2 pl-3", n.simulated ? "border-line-strong" : "border-accent")}>
                  <p className="text-sm">{n.text}</p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {n.by} · {fmtDateTime(n.at, now)} · {n.simulated ? "registro ficticio" : "registrado en esta demo"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-5">
          <div>
            <p className="eyebrow mb-2">Revisiones realizadas</p>
            {reviews.length === 0 ? (
              <p className="text-xs text-muted">Sin datos.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {reviews.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <p>{r.text}</p>
                    <p className="text-[11px] text-faint">{r.by} · {fmtDateTime(r.at, now)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="eyebrow mb-2">Próximas tareas programadas</p>
            <ul className="space-y-1.5 text-xs">
              {upcoming.slice(0, 3).map((t) => (
                <li key={t.id}>
                  <Link href={`/alerts?tab=tasks&task=${t.id}`} className="hover:underline">{t.title}</Link>
                  <p className={cx("text-[11px]", t.dueAt < now ? "text-danger" : "text-faint")}>
                    {TASK_STATUS_LABEL[t.status]} · {t.dueAt < now ? "vencida" : "vence"} {fmtDateTime(t.dueAt, now)}
                  </p>
                </li>
              ))}
              <li>
                <p>Revisión de rutina</p>
                <p className="text-[11px] text-faint">Según el intervalo de {config.rules.careReviewIntervalDays} días · {fmtDateTime(routineDue, now)}</p>
              </li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-2">Incidencias relacionadas</p>
            {incidents.length === 0 ? (
              <p className="text-xs text-muted">Sin datos.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {incidents.slice(0, 4).map((i) => (
                  <li key={i.id}>
                    <p>{i.text}</p>
                    <p className="text-[11px] text-faint">{fmtDateTime(i.at, now)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-3 rounded-xl border border-dashed border-line-strong p-3">
        <Stethoscope size={16} className="mt-0.5 shrink-0 text-faint" />
        <div className="text-xs">
          <p className="font-medium">Registros veterinarios</p>
          <p className="mt-0.5 text-muted">Sin datos en la demo. Se mantienen separados de las observaciones operativas y vendrán del sistema veterinario cuando se integre.</p>
          <p className="mt-1 text-[11px] text-faint">La plataforma no genera diagnósticos ni recomendaciones clínicas.</p>
        </div>
      </div>
    </Card>
  );
}

/* ───────────── 8. Alertas ───────────── */

function AlertsSection({ penguinId, className }: { penguinId: string; className?: string }) {
  const { dataset, alerts, setAlertStatus, now } = useDemo();
  const [open, setOpen] = useState<string | null>(null);
  const mine = alerts
    .filter((a) => a.penguinId === penguinId)
    .sort((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved") || b.createdAt - a.createdAt);

  return (
    <Card className={className} title={<span id="alertas" className="scroll-mt-20">Alertas e incidencias</span>} icon={BellRing} subtitle="El estado se comparte con Alerts & Tasks.">
      {mine.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-white/[0.03]">
            <ShieldCheck size={20} className="text-ok" />
          </span>
          <p className="text-sm">Sin alertas para este ejemplar</p>
          <p className="max-w-xs text-xs text-muted">Las alertas se abren solas cuando una regla se cumple (ubicación desactualizada, dispositivo sin comunicación, revisión pendiente…).</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {mine.map((a) => {
            const team = dataset.teams.find((t) => t.id === a.teamId);
            const expanded = open === a.id;
            return (
              <li key={a.id} className={cx("rounded-xl border border-line", a.status === "resolved" && "opacity-70")}>
                <button onClick={() => setOpen(expanded ? null : a.id)} className="flex w-full items-start gap-2 px-3 py-2.5 text-left">
                  <Badge tone={PRIORITY_TONE[a.priority]}>{PRIORITY_LABEL[a.priority]}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{ALERT_TYPE_LABEL[a.type]}</p>
                    <p className="text-[11px] text-faint">
                      {fmtDateTime(a.createdAt, now)} · {team?.name ?? "Sin asignar"}
                    </p>
                  </div>
                  <Badge tone={a.status === "resolved" ? "ok" : a.status === "following" ? "info" : "warn"}>{ALERT_STATUS_LABEL[a.status]}</Badge>
                  <ChevronDown size={14} className={cx("mt-0.5 text-faint transition", expanded && "rotate-180")} />
                </button>
                {expanded && (
                  <div className="border-t border-line px-3 py-2.5 text-xs">
                    <p className="text-muted">{a.description}</p>
                    <p className="mt-1 text-[11px] text-faint">Regla: {a.rule}</p>
                    <p className="eyebrow mb-1 mt-3">Historial de resolución</p>
                    <ol className="space-y-1">
                      <li className="text-[11px] text-faint">{fmtDateTime(a.createdAt, now)} · Alerta abierta por regla automática</li>
                      {a.history.map((h, i) => (
                        <li key={i} className="text-[11px]">
                          <span className="text-faint">{fmtDateTime(h.at, now)} · {h.by} · </span>
                          {h.text}
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/alerts?alert=${a.id}`} className="inline-flex h-8 items-center rounded-xl border border-line-strong px-2.5 text-xs hover:border-accent/50">
                        Abrir incidencia
                      </Link>
                      {PERMISSIONS.manageAlerts && a.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => setAlertStatus(a.id, "following")}>En seguimiento</Button>
                      )}
                      {PERMISSIONS.manageAlerts && a.status !== "resolved" && (
                        <Button size="sm" variant="primary" onClick={() => setAlertStatus(a.id, "resolved")}>Resolver</Button>
                      )}
                      {PERMISSIONS.manageAlerts && a.status === "resolved" && (
                        <Button size="sm" variant="ghost" onClick={() => setAlertStatus(a.id, "pending")}>Reabrir</Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ───────────── 9. Historial de cambios ───────────── */

type EventKind = "zone" | "readings" | "team" | "review" | "task" | "alert" | "note";
const EVENT_LABEL: Record<EventKind, string> = {
  zone: "Cambio de zona",
  readings: "Lecturas",
  team: "Equipo",
  review: "Revisión",
  task: "Tarea",
  alert: "Alerta",
  note: "Observación",
};
const EVENT_ICON: Record<EventKind, typeof MapPin> = { zone: MapPin, readings: Radio, team: ArrowRightLeft, review: ShieldCheck, task: ClipboardList, alert: BellRing, note: NotebookPen };

function TimelineSection({ penguinId, className }: { penguinId: string; className?: string }) {
  const { dataset, tasks, alerts, log, userNotes, range, now } = useDemo();
  const [kinds, setKinds] = useState<EventKind[]>([]);
  const [limit, setLimit] = useState(30);

  const events = useMemo(() => {
    const out: { at: number; kind: EventKind; text: string; warn?: boolean }[] = [];
    const recs = (dataset.activity.get(penguinId) ?? []).filter((x) => x.start >= range.from && x.start < range.to);
    for (let i = 1; i < recs.length; i++) {
      const a = recs[i - 1], c = recs[i];
      if (a.zoneId === c.zoneId) continue;
      out.push({ at: c.start, kind: "zone", text: `${ZONE_BY_ID[a.zoneId].name} → ${ZONE_BY_ID[c.zoneId].name}${c.start - a.end > 0 ? " (tras un hueco sin lectura)" : ""}` });
    }
    const list = dataset.readings.get(penguinId) ?? [];
    const perDay = new Map<number, number>();
    for (let i = firstIndexAtOrAfter(list, range.from); i < list.length && list[i].timestamp < range.to; i++) {
      const d = startOfDay(list[i].timestamp);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
    for (const [d, n] of perDay) out.push({ at: Math.min(d + DAY - MIN, now), kind: "readings", text: `${n} lecturas recibidas el ${fmtDate(d)}` });
    for (const l of log.filter((x) => x.penguinId === penguinId)) out.push({ at: l.at, kind: l.kind === "assignment" ? "team" : "review", text: l.text });
    for (const i of dataset.incidents.filter((x) => x.penguinId === penguinId && x.kind === "care")) out.push({ at: i.at, kind: "review", text: i.text });
    for (const t of tasks.filter((x) => x.penguinId === penguinId)) {
      if (!t.history.length) out.push({ at: t.createdAt, kind: "task", text: `${t.title} creada (${t.id})` });
      for (const h of t.history) out.push({ at: h.at, kind: "task", text: `${t.title}: ${h.text}` });
    }
    for (const a of alerts.filter((x) => x.penguinId === penguinId)) {
      out.push({ at: a.createdAt, kind: "alert", text: `Alerta abierta: ${ALERT_TYPE_LABEL[a.type]}`, warn: true });
      for (const h of a.history) out.push({ at: h.at, kind: "alert", text: `${ALERT_TYPE_LABEL[a.type]}: ${h.text}` });
    }
    for (const n of userNotes.filter((x) => x.penguinId === penguinId)) out.push({ at: n.at, kind: "note", text: `${n.by}: ${n.text}` });
    return out.filter((e) => e.at <= now + HOUR).sort((a, b) => b.at - a.at);
  }, [dataset, penguinId, range, tasks, alerts, log, userNotes, now]);

  const shown = kinds.length ? events.filter((e) => kinds.includes(e.kind)) : events;

  return (
    <Card
      className={className}
      title={<span id="historial" className="scroll-mt-20">Historial de cambios</span>}
      icon={History}
      subtitle={`Zonas y lecturas: ${range.label.toLowerCase()}. Equipo, revisiones, tareas y alertas: todo el registro.`}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(EVENT_LABEL) as EventKind[]).map((k) => {
          const on = kinds.includes(k);
          return (
            <button
              key={k}
              onClick={() => setKinds(on ? kinds.filter((x) => x !== k) : [...kinds, k])}
              className={cx("rounded-full border px-2.5 py-0.5 text-[11px] transition", on ? "border-accent/50 bg-accent/12 text-ink" : "border-line-strong text-muted hover:text-ink")}
            >
              {EVENT_LABEL[k]}
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">Sin eventos.</p>
      ) : (
        <ol className="scroll-thin relative max-h-[440px] space-y-1 overflow-y-auto pr-1 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-line-strong">
          {shown.slice(0, limit).map((e, i) => {
            const Icon = EVENT_ICON[e.kind];
            return (
              <li key={i} className="relative flex gap-3 px-1 py-1.5">
                <span className="z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line-strong bg-[#06182a]">
                  <Icon size={13} className={e.warn ? "text-warn" : "text-accent"} />
                </span>
                <div className="min-w-0 text-xs">
                  <p className="text-ink">{e.text}</p>
                  <p className="text-[11px] text-faint">
                    {EVENT_LABEL[e.kind]} · {fmtDateTime(e.at, now)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {shown.length > limit && (
        <button onClick={() => setLimit((l) => l + 40)} className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ChevronDown size={13} /> Mostrar más ({shown.length - limit})
        </button>
      )}
    </Card>
  );
}

/* ───────────── auxiliares ───────────── */

function Kpi({ label, value, sub, color, warn, small }: { label: string; value: string; sub?: string; color?: string; warn?: boolean; small?: boolean }) {
  return (
    <div className="panel px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        {color && <span className="h-2 w-2 rounded-sm" style={{ background: color }} />}
        {label}
      </p>
      <p className={cx("num mt-1 truncate font-semibold", small ? "text-base" : "text-xl", warn && "text-warn")}>{value}</p>
      {sub && <p className="truncate text-[11px] text-faint">{sub}</p>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line pb-2 last:border-0">
      <dt className="shrink-0 text-[12px] text-muted">{k}</dt>
      <dd className="text-right text-[13px]">{v}</dd>
    </div>
  );
}

function MetricBlock({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <span className="h-2 w-2 rounded-sm" style={{ background: color }} /> {label}
      </p>
      <p className="num mt-1 text-2xl font-semibold">{value}</p>
      <p className="text-[11px] text-faint">{sub}</p>
    </div>
  );
}

function Compare({ label, cur, prev }: { label: string; cur: number; prev: number }) {
  const diff = cur - prev;
  return (
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p className="num font-semibold">{fmtHours(cur)}</p>
      <p className="num text-[11px] text-faint">
        antes {fmtHours(prev)} · {diff >= 0 ? "+" : "−"}
        {fmtHours(Math.abs(diff))}
      </p>
    </div>
  );
}
