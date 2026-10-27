/**
 * Convierte los datos simulados de la demo en texto para el chat de reportes:
 * una lista corta de toda la colonia y una ficha detallada por pingüino.
 * Todo sale de las lecturas, huecos y tramos del Dataset, igual que las pantallas.
 */
import { ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES_BY_ID } from "@/domain/species";
import type { Penguin } from "@/domain/types";
import { INSIGHT_LABEL } from "@/logic/insights";
import { computeActivity, type Breakdown } from "@/logic/metrics";
import { STATUS_LABEL } from "@/logic/status";
import { DAY, HOUR } from "@/logic/time";
import type { DemoContextValue } from "@/state/DemoProvider";

export type ChatData = Pick<DemoContextValue, "dataset" | "snapshots" | "teamOf" | "userNotes" | "log" | "now" | "lastReviewOf" | "insights" | "cases">;

const dtFmt = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "2-digit", month: "short" });
const dt = (ts: number) => dtFmt.format(ts);
const h = (ms: number) => `${(ms / HOUR).toFixed(1)} h`;
const zoneName = (id: string) => ZONE_BY_ID[id]?.name ?? id;
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

function teamLabel(d: ChatData, penguinId: string) {
  const t = d.dataset.teams.find((x) => x.id === d.teamOf(penguinId));
  return t ? `${t.name} (líder: ${t.lead})` : "sin equipo";
}

/** Una línea por pingüino: suficiente para comparar o encontrar a quién se refiere el usuario. */
export function colonyRoster(d: ChatData): string {
  const lines = ["código | nombre | especie | equipo | estado | zona | última lectura"];
  for (const p of d.dataset.penguins) {
    const s = d.snapshots.get(p.id);
    const r = s?.reading;
    lines.push(
      [
        p.id,
        p.name ?? "—",
        SPECIES_BY_ID[p.speciesId].nameEs,
        d.dataset.teams.find((t) => t.id === d.teamOf(p.id))?.name ?? "—",
        s ? STATUS_LABEL[s.status] : "Sin datos",
        r ? zoneName(r.zoneId) : "—",
        r ? `hace ${Math.round(s!.ageMin)} min` : "—",
      ].join(" | "),
    );
  }
  return `Corte de lecturas: ${dt(d.now)}. ${d.dataset.penguins.length} ejemplares.\n${lines.join("\n")}`;
}

function breakdownLine(b: Breakdown) {
  const tracked = b.water + b.land;
  return `agua ${h(b.water)} (${pct(b.water, tracked)}), tierra ${h(b.land)} (de ello sin movimiento ${h(b.stationary)}), ${b.readings} lecturas`;
}

/** Ficha detallada de un pingüino con todo lo que la demo sabe de él. */
export function penguinDossier(d: ChatData, p: Penguin): string {
  const { dataset: ds, now } = d;
  const sp = SPECIES_BY_ID[p.speciesId];
  const snap = d.snapshots.get(p.id);
  const device = ds.devices.find((x) => x.id === p.deviceId);
  const out: string[] = [];

  out.push(`## ${p.id}${p.name ? ` · ${p.name}` : ""}`);
  out.push(`Especie: ${sp.nameEs} (${sp.nameEn}, ${sp.scientific}). Equipo: ${teamLabel(d, p.id)}.`);
  out.push(`Alta: ${dt(p.registeredAt)}. Registro: ${p.recordStatus}. Anillo: ${p.bandColor}. Última revisión del equipo: ${dt(d.lastReviewOf(p.id))}.`);
  if (device) out.push(`Dispositivo: ${device.id}.`);

  if (snap) {
    const r = snap.reading;
    out.push(
      `Estado actual: ${STATUS_LABEL[snap.status]}.` +
        (r
          ? ` Última lectura ${dt(r.timestamp)} (hace ${Math.round(snap.ageMin)} min) en ${zoneName(r.zoneId)}, medio ${r.medium === "water" ? "agua" : "tierra"}, posición (${(r.x / ds.habitat.unitsPerMeter).toFixed(1)} m, ${(r.y / ds.habitat.unitsPerMeter).toFixed(1)} m), precisión ±${r.accuracyM} m, fuente ${r.source}, calidad ${r.quality}.`
          : " Sin lecturas."),
    );
  }

  const ins = d.insights.get(p.id);
  if (ins) {
    out.push(`\n### ¿Cómo va? (indicador automático de la demo): ${INSIGHT_LABEL[ins.level]}`);
    for (const pt of ins.points) out.push(`- ${pt.text}`);
  }

  const cases = d.cases.filter((c) => c.penguinId === p.id);
  out.push(`\n### Seguimiento de salud (${cases.length} casos)`);
  for (const c of cases) {
    out.push(`- ${c.status === "open" ? "ABIERTO" : "Cerrado"} · ${c.title} (motivo: ${c.reason}, responsable: ${c.owner}, abierto ${dt(c.openedAt)}${c.closedAt ? `, cerrado ${dt(c.closedAt)}` : ""})`);
    for (const e of [...c.entries].reverse()) out.push(`  - ${dt(e.at)}, ${e.by}: ${e.text}${e.weightKg !== undefined ? ` [peso ${e.weightKg} kg]` : ""}`);
  }

  // Actividad: últimas 24 h, toda la ventana disponible y el promedio de su especie.
  const from = Math.max(ds.windowStart, p.registeredAt);
  const last24 = computeActivity(ds, [p.id], now - DAY, now);
  const all = computeActivity(ds, [p.id], from, now);
  const peers = ds.penguins.filter((x) => x.speciesId === p.speciesId).map((x) => x.id);
  const species = computeActivity(ds, peers, from, now);
  const avg = (k: keyof Breakdown) => species.totals[k] / Math.max(1, peers.length);
  const days = Math.max(1, (now - from) / DAY);

  out.push(`\n### Actividad`);
  out.push(`Últimas 24 h: ${breakdownLine(last24.totals)}.`);
  out.push(`Ventana completa (${days.toFixed(1)} días desde ${dt(from)}): ${breakdownLine(all.totals)}.`);
  out.push(
    `Promedio por día de este ejemplar vs. su especie (${peers.length} ejemplares, mismo periodo): agua ${h(all.totals.water / days)} vs ${h(avg("water") / days)}, tierra ${h(all.totals.land / days)} vs ${h(avg("land") / days)}, sin movimiento ${h(all.totals.stationary / days)} vs ${h(avg("stationary") / days)}.`,
  );

  out.push(`\nPor día (agua / tierra / sin movimiento):`);
  for (const b of all.daily) out.push(`- ${dayFmt.format(b.day)}: ${h(b.water)} / ${h(b.land)} / ${h(b.stationary)}`);

  out.push(`\nPor hora del día, toda la ventana (agua / tierra):`);
  out.push(all.hourly.map((b, i) => `${String(i).padStart(2, "0")}h ${h(b.water)}/${h(b.land)}`).join(" · "));

  const zones = [...all.zoneTime.entries()].sort((a, b) => b[1] - a[1]);
  out.push(`\nTiempo por zona: ${zones.map(([z, t]) => `${zoneName(z)} ${h(t)}`).join(", ") || "—"}.`);
  const moves = [...all.transitions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  out.push(`Cambios de zona más frecuentes: ${moves.map(([k, n]) => `${k.split(">").map(zoneName).join(" → ")} (${n})`).join(", ") || "ninguno observado"}.`);

  // Recorrido de las últimas 24 h por tramos continuos.
  const recs = (ds.activity.get(p.id) ?? []).filter((r) => r.end > now - DAY);
  out.push(`\n### Recorrido últimas 24 h (${recs.length} tramos)`);
  for (const r of recs.slice(-60)) {
    out.push(`- ${dt(r.start)}–${dt(r.end)}: ${r.medium === "water" ? "agua" : "tierra"} en ${zoneName(r.zoneId)}${r.stationary ? ", sin movimiento" : ""} (${r.readings} lecturas)`);
  }

  const notes = [...d.userNotes, ...ds.notes].filter((n) => n.penguinId === p.id).sort((a, b) => b.at - a.at);
  out.push(`\n### Notas del equipo (${notes.length})`);
  for (const n of notes.slice(0, 20)) out.push(`- ${dt(n.at)}, ${n.by}: ${n.text}`);

  const incidents = [...d.log, ...ds.incidents].filter((i) => i.penguinId === p.id).sort((a, b) => b.at - a.at);
  if (incidents.length) {
    out.push(`\n### Bitácora (${incidents.length})`);
    for (const i of incidents.slice(0, 20)) out.push(`- ${dt(i.at)}: ${i.text}`);
  }

  return out.join("\n");
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Pingüinos que menciona un texto, por código (KNG-005) o por nombre completo. */
export function mentionedPenguins(penguins: Penguin[], text: string): Penguin[] {
  const t = norm(text);
  const codes = new Set((text.toUpperCase().match(/\b[A-Z]{3}-\d{3}\b/g) ?? []));
  return penguins.filter((p) => codes.has(p.id) || (p.name && p.name.length > 2 && new RegExp(`\\b${norm(p.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t)));
}
