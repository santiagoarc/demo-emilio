"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Bird,
  ClipboardList,
  CloudOff,
  Droplets,
  ExternalLink,
  Map as MapIcon,
  MapPinned,
  Mountain,
  Timer,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { PENGUIN_ZONES, ZONE_BY_ID, ZONE_KIND_LABEL } from "@/domain/habitat";
import { SPECIES, SPECIES_BY_ID } from "@/domain/species";
import { ALERT_TYPE_LABEL } from "@/logic/alertRules";
import { RANGE_LABEL, type RangePreset } from "@/logic/filters";
import { TASK_KIND_LABEL } from "@/logic/labels";
import { computeActivity, type Breakdown } from "@/logic/metrics";
import type { LiveStatus, Snapshot } from "@/logic/status";
import { fmtAgo, fmtTime } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { Donut, SERIES, StackedColumns } from "@/components/charts/Charts";
import { HabitatMap, type MapMarker } from "@/components/map/HabitatMap";
import { PenguinIllustration } from "@/components/penguin/PenguinIllustration";
import { StatusPill, STATUS_COLOR } from "@/components/penguin/StatusPill";
import { Segmented, cx } from "@/components/ui/primitives";
import { isOpenTask } from "@/logic/tasks";

/** Estado actual agrupado como se lee en el Overview. */
type StatusGroup = "water" | "land" | "no_recent";
const STATUS_GROUP: Record<LiveStatus, StatusGroup> = {
  water: "water",
  land: "land",
  resting: "land",
  stale: "no_recent",
  offline: "no_recent",
  no_data: "no_recent",
};

type Category = "location" | "device" | "care";
const CATEGORY_LABEL: Record<Category, string> = { location: "Ubicación", device: "Dispositivo", care: "Cuidado" };

const RANGES: RangePreset[] = ["today", "24h", "7d", "14d"];
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function OverviewView() {
  const { dataset, visible, snapshots, teamOf, alerts, tasks, range, filters, setFilters, now } = useDemo();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [tab, setTab] = useState<Category | "all">("all");

  // Ejemplares que pasan los filtros globales.
  const shown = useMemo(() => visible.map((p) => snapshots.get(p.id)!), [visible, snapshots]);
  const ids = useMemo(() => shown.map((s) => s.penguin.id), [shown]);
  const idSet = useMemo(() => new Set(ids), [ids]);
  const zoneSet = useMemo(() => new Set(filters.zones), [filters.zones]);
  const teamName = (id: string) => dataset.teams.find((t) => t.id === id)?.name ?? "—";
  const teamColor = (id: string) => dataset.teams.find((t) => t.id === id)?.color ?? "var(--muted)";

  const total = shown.length;
  const count = (g: StatusGroup) => shown.filter((s) => STATUS_GROUP[s.status] === g).length;
  const inWater = count("water");
  const onLand = count("land");
  const noRecent = count("no_recent");
  const teamsActive = new Set(ids.map(teamOf)).size;

  // Alertas abiertas y tareas sin alerta propia (una tarea vencida ya tiene la suya).
  const teamFilter = filters.teams.length ? new Set(filters.teams) : null;
  const inScope = (penguinId: string | undefined, teamId: string) => (penguinId ? idSet.has(penguinId) : !teamFilter || teamFilter.has(teamId));
  const openAlerts = alerts.filter((a) => a.status !== "resolved" && inScope(a.penguinId, a.teamId));
  const alertedTasks = new Set(openAlerts.map((a) => a.taskId).filter(Boolean));
  const openTasks = tasks.filter((t) => isOpenTask(t) && !alertedTasks.has(t.id) && inScope(t.penguinId, t.teamId));

  const pending = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const rank = { high: 0, medium: 1, low: 2 } as const;
    const items: PendingItem[] = [
      ...openAlerts.map((a): PendingItem => {
        const kind = a.taskId ? taskById.get(a.taskId)?.kind : undefined;
        return {
          key: a.id,
          href: `/alerts?alert=${a.id}`,
          title: ALERT_TYPE_LABEL[a.type],
          penguinId: a.penguinId,
          zoneId: a.taskId ? taskById.get(a.taskId)?.zoneId : undefined,
          teamId: a.teamId,
          priority: a.priority,
          category: a.type === "stale_location" ? "location" : a.type === "device_offline" || kind === "device_check" ? "device" : "care",
          sort: rank[a.priority],
          since: a.createdAt,
          time: fmtAgo(a.createdAt, now).replace("hace ", ""),
          late: false,
        };
      }),
      ...openTasks.map((t): PendingItem => ({
        key: t.id,
        href: `/alerts?tab=tasks&task=${t.id}`,
        title: t.title || TASK_KIND_LABEL[t.kind],
        penguinId: t.penguinId,
        zoneId: t.zoneId,
        teamId: t.teamId,
        priority: null,
        category: t.kind === "device_check" ? "device" : "care",
        sort: 3,
        since: t.dueAt,
        time: t.dueAt < now ? `venció ${fmtAgo(t.dueAt, now).replace("hace ", "")}` : `vence ${fmtAgo(t.dueAt, now)}`,
        late: t.dueAt < now,
      })),
    ];
    return items.sort((a, b) => a.sort - b.sort || a.since - b.since);
  }, [openAlerts, openTasks, tasks, now]);
  const pendingShown = tab === "all" ? pending : pending.filter((p) => p.category === tab);

  // Actividad del periodo y del periodo anterior de la misma duración.
  const agg = useMemo(() => computeActivity(dataset, ids, range.from, range.to, zoneSet), [dataset, ids, range, zoneSet]);
  const prevAgg = useMemo(() => {
    const len = range.to - range.from;
    if (len <= 0 || range.from - len < dataset.windowStart) return null;
    return computeActivity(dataset, ids, range.from - len, range.from, zoneSet);
  }, [dataset, ids, range, zoneSet]);

  const zoneCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of shown) if (s.reading) m.set(s.reading.zoneId, (m.get(s.reading.zoneId) ?? 0) + 1);
    return m;
  }, [shown]);
  const located = [...zoneCounts.values()].reduce((a, b) => a + b, 0);

  const markers: MapMarker[] = shown
    .filter((s) => s.reading)
    .map((s) => ({
      id: s.penguin.id,
      x: s.reading!.x,
      y: s.reading!.y,
      color: SPECIES_BY_ID[s.penguin.speciesId].color,
      status: s.status,
      medium: s.reading!.medium,
      accuracyM: s.reading!.accuracyM,
    }));

  const selected = selectedId && idSet.has(selectedId) ? snapshots.get(selectedId)! : null;
  const zone = zoneId ? ZONE_BY_ID[zoneId] : null;
  const fullMapHref = selected ? `/map?penguin=${selected.penguin.id}` : zone ? `/map?zone=${zone.id}` : "/map";
  const kpis: { label: string; value: number; share?: number; icon: LucideIcon; color: string; href: string }[] = [
    { label: "Pingüinos registrados", value: total, icon: Bird, color: "var(--ice)", href: "/penguins" },
    { label: "En agua", value: inWater, share: pct(inWater, total), icon: Droplets, color: SERIES.water, href: "/map" },
    { label: "En tierra", value: onLand, share: pct(onLand, total), icon: Mountain, color: SERIES.land, href: "/map" },
    { label: "Sin ubicación reciente", value: noRecent, share: pct(noRecent, total), icon: CloudOff, color: "var(--warn)", href: "/penguins" },
    { label: "Equipos activos", value: teamsActive, icon: Users, color: "#a78bfa", href: "/teams" },
    { label: "Alertas pendientes", value: openAlerts.length, icon: BellRing, color: "var(--danger)", href: "/alerts" },
  ];

  return (
    <div className="space-y-3 px-4 pb-6 pt-4 lg:px-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">SeaWorld · Penguin Tracking & Care</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Penguin Operations Overview</h1>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full bg-ok" />
              Datos simulados · lectura de las {fmtTime(now)}
            </span>
          </div>
        </div>
        <Segmented<RangePreset>
          value={RANGES.includes(filters.range) ? filters.range : "24h"}
          onChange={(v) => setFilters({ range: v })}
          options={RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }))}
        />
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="panel group flex items-center gap-3 px-4 py-3 transition hover:border-line-strong">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${k.color} 14%, transparent)`, color: k.color }}>
              <k.icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="num text-[24px] font-semibold leading-none" style={k.label === "Alertas pendientes" && k.value > 0 ? { color: k.color } : undefined}>
                {k.value}
              </p>
              <p className="mt-1 flex items-baseline justify-between gap-2 text-[11px] text-muted">
                <span className="truncate">{k.label}</span>
                {k.share !== undefined && <span className="num text-faint">{k.share}%</span>}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Mapa + distribución lateral */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel flex min-w-0 flex-col overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <MapIcon size={17} className="text-accent" />
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">Mapa del hábitat</h3>
                <p className="text-[11px] text-muted">Última ubicación registrada de cada ejemplar · {located} con posición</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={fullMapHref} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-semibold text-white hover:bg-[#0b8178]">
                <MapPinned size={14} /> Abrir mapa completo
              </Link>
            </div>
          </header>

          <div className="relative h-[clamp(340px,calc(100vh-290px),700px)] w-full border-y border-line bg-[#ece2cd]">
            <HabitatMap
              markers={markers}
              selectedId={selected?.penguin.id ?? null}
              onSelect={(id) => {
                setSelectedId(id);
                if (id) setZoneId(null);
              }}
              selectedZones={zone ? [zone.id] : []}
              onZoneClick={(z) => {
                if (ZONE_BY_ID[z].kind === "restricted") return;
                setZoneId(z === zoneId ? null : z);
                setSelectedId(null);
              }}
              zoneCounts={zoneCounts}
              labelScale={1.35}
              live
              penguinMarkers={filters.teams.length > 0}
              layers={{ zones: true, labels: true, landmarks: false, markers: true, lastKnown: true, restricted: true, trail: false }}
            />
            {selected && <PenguinCard s={selected} team={teamName(teamOf(selected.penguin.id))} now={now} onClose={() => setSelectedId(null)} />}
            {!selected && zone && (
              <MapCard onClose={() => setZoneId(null)}>
                <p className="eyebrow">{ZONE_KIND_LABEL[zone.kind]}{zone.restricted ? " · restringida" : ""}</p>
                <p className="mt-0.5 text-sm font-semibold">{zone.name}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {zoneCounts.get(zone.id) ?? 0} ejemplares con su última ubicación aquí · {dataset.teams.filter((t) => t.zoneIds.includes(zone.id)).map((t) => t.name).join(", ") || "sin equipo asignado"}
                </p>
                <div className="mt-2.5 flex gap-1.5">
                  <Link href={`/map?zone=${zone.id}`} className="inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-semibold text-white">
                    Abrir en Habitat Map <ArrowUpRight size={12} />
                  </Link>
                  <button
                    onClick={() => setFilters({ zones: filters.zones.includes(zone.id) ? filters.zones.filter((x) => x !== zone.id) : [...filters.zones, zone.id] })}
                    className="inline-flex h-7 items-center rounded-lg border border-line-strong px-2.5 text-[11px] text-ink hover:bg-ink/5"
                  >
                    {filters.zones.includes(zone.id) ? "Quitar filtro" : "Filtrar por zona"}
                  </button>
                </div>
              </MapCard>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-[11px] text-muted">
            {SPECIES.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.nameEs.replace("Pingüino ", "")}
              </span>
            ))}
            <span className="mx-1 hidden h-3 w-px bg-line-strong sm:block" />
            <LegendMark ring color={SERIES.water} label="En agua" />
            <LegendMark color={SERIES.land} label="En tierra" />
            <LegendMark dashed color={STATUS_COLOR.stale} label="Sin posición reciente" />
            <LegendMark dashed color={STATUS_COLOR.offline} label="Sin comunicación" />
            <span className="ml-auto text-faint">Clic en un ejemplar o una zona para ver su detalle</span>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 xl:grid-rows-[auto_1fr]">
          <Panel title="Distribución por especie" icon={Bird} href="/species" linkLabel="Ver todas">
            <ul className="space-y-1">
              {SPECIES.map((s) => {
                const n = shown.filter((x) => x.penguin.speciesId === s.id).length;
                const on = filters.species.includes(s.id);
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setFilters({ species: on ? filters.species.filter((x) => x !== s.id) : [...filters.species, s.id] })}
                      title={on ? "Quitar filtro" : "Filtrar por especie"}
                      className={cx("flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition hover:bg-ink/[0.03]", on && "bg-ink/[0.05]")}
                    >
                      <PenguinIllustration speciesId={s.id} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate text-[13px]">{s.nameEs}</span>
                          <span className="num w-7 text-right text-sm font-semibold">{n}</span>
                          <span className="num w-9 text-right text-[11px] text-faint">{pct(n, total)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct(n, total)}%`, background: s.color }} />
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Equipos de cuidado" icon={Users} href="/teams" linkLabel="Ver todos">
            <ul className="space-y-2.5">
              {dataset.teams.map((t) => {
                const n = ids.filter((id) => teamOf(id) === t.id).length;
                const work = pending.filter((p) => p.teamId === t.id).length;
                return (
                  <li key={t.id} className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${t.color}22`, color: t.color }}>
                      <Users size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px]">{t.name}</span>
                        <span className="num text-[11px] text-faint">{pct(n, total)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct(n, total)}%`, background: t.color }} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        <span className="num">{n}</span> pingüinos · <span className="num">{work}</span> pendientes
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>

      {/* Sección inferior */}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <ActivityPanel agg={agg.totals} prev={prevAgg?.totals ?? null} daily={agg} rangeLabel={range.label} zonesFiltered={filters.zones.length > 0} />

        <Panel title="Pingüinos por zona del hábitat" icon={MapPinned} href="/map" linkLabel="Ver en el mapa">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px_40px] gap-x-3 pb-1.5 text-[10px] uppercase tracking-wider text-faint">
            <span>Zona</span>
            <span />
            <span className="text-right">Ejempl.</span>
            <span className="text-right">%</span>
          </div>
          <ul className="scroll-thin max-h-[236px] overflow-y-auto pr-1">
            {PENGUIN_ZONES.map((z) => ({ z, n: zoneCounts.get(z.id) ?? 0 }))
              .sort((a, b) => b.n - a.n)
              .map(({ z, n }) => (
                <li key={z.id}>
                  <Link
                    href={`/map?zone=${z.id}`}
                    title="Abrir la zona en Habitat Map"
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px_40px] items-center gap-x-3 rounded-md py-1 text-[12px] hover:bg-ink/[0.03]"
                  >
                    <span className="truncate">{z.name}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                      <span className="block h-full rounded-full" style={{ width: `${pct(n, Math.max(1, ...zoneCounts.values()))}%`, background: zoneColor(z.id) }} />
                    </span>
                    <span className="num text-right">{n}</span>
                    <span className="num text-right text-faint">{pct(n, located)}%</span>
                  </Link>
                </li>
              ))}
          </ul>
        </Panel>

        <Panel title="Alertas y tareas pendientes" icon={ClipboardList} href="/alerts" linkLabel="Ver todas" className="lg:col-span-2 xl:col-span-1">
          <div className="mb-2 flex flex-wrap gap-1">
            {(["all", "location", "device", "care"] as const).map((c) => {
              const n = c === "all" ? pending.length : pending.filter((p) => p.category === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setTab(c)}
                  className={cx(
                    "h-7 rounded-lg border px-2.5 text-[11px] transition",
                    tab === c ? "border-accent/50 bg-accent/10 text-ink" : "border-line text-muted hover:text-ink",
                  )}
                >
                  {c === "all" ? "Todas" : CATEGORY_LABEL[c]} <span className="num">({n})</span>
                </button>
              );
            })}
          </div>
          {pendingShown.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">Nada pendiente con estos filtros.</p>
          ) : (
            <ul className="scroll-thin max-h-[222px] divide-y divide-line overflow-y-auto pr-1">
              {pendingShown.map((p) => (
                <li key={p.key} className="flex items-center gap-2.5 py-1.5 text-[12px]">
                  <span
                    title={p.priority ? `Prioridad ${p.priority === "high" ? "alta" : p.priority === "medium" ? "media" : "baja"}` : "Tarea abierta"}
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: p.priority === "high" ? "var(--danger)" : p.priority === "medium" ? "var(--warn)" : p.priority === "low" ? "var(--muted)" : "var(--accent-2)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={p.href} className="block truncate hover:text-accent">
                      {p.title}
                    </Link>
                    <p className="truncate text-[11px] text-faint">
                      {p.penguinId ? (
                        <Link href={`/penguins/${p.penguinId}`} className="font-mono text-muted hover:text-accent">
                          {p.penguinId}
                        </Link>
                      ) : p.zoneId ? (
                        ZONE_BY_ID[p.zoneId]?.name
                      ) : (
                        "General"
                      )}
                      <span className="mx-1">·</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: teamColor(p.teamId) }} />
                        {teamName(p.teamId)}
                      </span>
                    </p>
                  </div>
                  <span className={cx("whitespace-nowrap text-right text-[11px]", p.late ? "text-danger" : "text-muted")}>{p.time}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

interface PendingItem {
  key: string;
  href: string;
  title: string;
  penguinId?: string;
  zoneId?: string;
  teamId: string;
  priority: "high" | "medium" | "low" | null;
  category: Category;
  sort: number;
  since: number;
  time: string;
  late: boolean;
}

function zoneColor(id: string) {
  const z = ZONE_BY_ID[id];
  return z.medium === "water" ? SERIES.water : z.kind === "feeding" ? "var(--accent)" : z.kind === "care" ? "#a78bfa" : SERIES.land;
}

function Panel({ title, icon: Icon, href, linkLabel, className, children }: {
  title: string;
  icon: LucideIcon;
  href: string;
  linkLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("panel flex min-w-0 flex-col p-4", className)}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
          <Icon size={16} className="text-accent" />
          {title}
        </h3>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[11px] text-accent hover:underline">
          {linkLabel} <ArrowRight size={12} />
        </Link>
      </header>
      {children}
    </section>
  );
}

function LegendMark({ color, label, ring, dashed }: { color: string; label: string; ring?: boolean; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={dashed ? { border: `1.5px dashed ${color}` } : ring ? { background: "#9fb3c8", boxShadow: `0 0 0 2px var(--panel-solid), 0 0 0 3px ${color}` } : { background: color }}
      />
      {label}
    </span>
  );
}

function MapCard({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="panel absolute left-3 top-3 z-10 w-[min(320px,calc(100%-24px))] p-3 shadow-2xl">
      <button onClick={onClose} aria-label="Cerrar" className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink">
        <X size={13} />
      </button>
      {children}
    </div>
  );
}

function PenguinCard({ s, team, now, onClose }: { s: Snapshot; team: string; now: number; onClose: () => void }) {
  const sp = SPECIES_BY_ID[s.penguin.speciesId];
  return (
    <MapCard onClose={onClose}>
      <div className="flex gap-3">
        <PenguinIllustration speciesId={s.penguin.speciesId} size={56} />
        <div className="min-w-0 flex-1 pr-5">
          <p className="font-mono text-sm font-semibold">{s.penguin.id}</p>
          <p className="truncate text-[11px] text-muted">{sp.nameEs}</p>
          <div className="mt-1.5">
            <StatusPill status={s.status} compact />
          </div>
        </div>
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-faint">Zona</dt>
        <dd className="truncate text-right">{s.reading ? ZONE_BY_ID[s.reading.zoneId].name : "—"}</dd>
        <dt className="text-faint">Última lectura</dt>
        <dd className="text-right">{s.reading ? fmtAgo(s.reading.timestamp, now) : "sin lecturas"}</dd>
        <dt className="text-faint">Equipo</dt>
        <dd className="truncate text-right">{team}</dd>
      </dl>
      <div className="mt-2.5 flex gap-1.5">
        <Link href={`/penguins/${s.penguin.id}`} className="inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-semibold text-white">
          Ver ficha <ArrowUpRight size={12} />
        </Link>
        <Link href={`/map?penguin=${s.penguin.id}`} className="inline-flex h-7 items-center gap-1 rounded-lg border border-line-strong px-2.5 text-[11px] text-ink hover:bg-ink/5">
          <ExternalLink size={11} /> Recorrido en el mapa
        </Link>
      </div>
    </MapCard>
  );
}

function ActivityPanel({ agg, prev, daily, rangeLabel, zonesFiltered }: {
  agg: Breakdown;
  prev: Breakdown | null;
  daily: ReturnType<typeof computeActivity>;
  rangeLabel: string;
  zonesFiltered: boolean;
}) {
  // Reparto del tiempo esperado del periodo; lo que no tiene lectura va aparte.
  const share = (b: Breakdown, k: "water" | "land" | "gap") => {
    const v = k === "gap" ? b.noFix + b.noComm : b[k];
    return b.expected > 0 ? (v / b.expected) * 100 : 0;
  };
  const rings = [
    { k: "water" as const, label: "En agua", color: SERIES.water },
    { k: "land" as const, label: "En tierra", color: SERIES.land },
    { k: "gap" as const, label: "Sin lectura", color: SERIES.noFix },
  ];
  const multiDay = daily.daily.length > 2;
  return (
    <Panel title="Actividad en agua y tierra" icon={Timer} href="/analytics" linkLabel="Analítica">
      <p className="-mt-1.5 mb-2 text-[11px] text-muted">{rangeLabel} · porcentaje del tiempo registrado por ejemplar</p>
      <div className="grid grid-cols-3 gap-2">
        {rings.map((r) => {
          const v = share(agg, r.k);
          const d = prev ? v - share(prev, r.k) : null;
          return (
            <div key={r.k} className="flex flex-col items-center text-center">
              <Donut
                size={84}
                thickness={9}
                parts={[
                  { value: v, color: r.color, label: r.label },
                  { value: Math.max(0, 100 - v), color: "rgba(11,36,64,0.04)", label: "Resto" },
                ]}
                center={<span className="num text-[17px] font-semibold">{Math.round(v)}%</span>}
              />
              <p className="mt-1.5 text-[12px]">{r.label}</p>
              <p className="num text-[11px] text-faint">
                {d === null ? "sin periodo previo" : `${d >= 0.5 ? "+" : d <= -0.5 ? "−" : "±"}${Math.abs(Math.round(d))} pp vs. anterior`}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <StackedColumns
          height={54}
          labelEvery={multiDay ? Math.ceil(daily.daily.length / 7) : 6}
          format={(v) => `${Math.round(v * 100)}%`}
          series={[
            { key: "water", color: SERIES.water, label: "Agua" },
            { key: "land", color: SERIES.land, label: "Tierra" },
            { key: "gap", color: SERIES.noFix, label: "Sin lectura" },
          ]}
          data={(multiDay ? daily.daily : daily.hourly).map((b: Breakdown & { day?: number }, i) => {
            const tot = b.water + b.land + b.noFix + b.noComm || 1;
            const label = multiDay && b.day !== undefined ? new Date(b.day).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : `${String(i).padStart(2, "0")}h`;
            return { label, values: { water: b.water / tot, land: b.land / tot, gap: (b.noFix + b.noComm) / tot } };
          })}
        />
      </div>
      {zonesFiltered && <p className="mt-1 text-[10px] text-faint">Con filtro de zona solo cuentan las lecturas dentro de esas zonas.</p>}
    </Panel>
  );
}
