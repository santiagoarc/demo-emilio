/**
 * Respuestas del chat armadas con la información del sistema, sin servicios
 * externos: reporte de un pingüino, comparaciones y preguntas de la colonia.
 * Usa las mismas cifras que las pantallas (computeActivity, insights, casos).
 */
import { PENGUIN_ZONES, ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES, SPECIES_BY_ID } from "@/domain/species";
import type { Penguin } from "@/domain/types";
import { INSIGHT_LABEL } from "@/logic/insights";
import { computeActivity } from "@/logic/metrics";
import { STATUS_LABEL } from "@/logic/status";
import { DAY, HOUR } from "@/logic/time";
import type { ChatData } from "./penguinContext";

const dtFmt = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const dt = (ts: number) => dtFmt.format(ts);
const h = (ms: number) => `${(ms / HOUR).toFixed(1)} h`;
const zoneName = (id: string) => ZONE_BY_ID[id]?.name ?? id;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const label = (p: Penguin) => `**${p.id}**${p.name ? ` (${p.name})` : ""}`;
const teamName = (d: ChatData, id: string) => d.dataset.teams.find((t) => t.id === d.teamOf(id))?.name ?? "sin equipo";

/** Agua y tierra por día de un grupo de ejemplares en la ventana disponible. */
function perDay(d: ChatData, ids: string[]) {
  const from = d.dataset.windowStart;
  const days = Math.max(1, (d.now - from) / DAY);
  const t = computeActivity(d.dataset, ids, from, d.now).totals;
  const n = Math.max(1, ids.length);
  return { water: t.water / days / n, land: t.land / days / n, still: t.stationary / days / n };
}

const dayFmt = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "2-digit", month: "short" });
const share = (water: number, land: number) => (water + land > 0 ? water / (water + land) : 0);

/** Proporción del tiempo en el agua, día por día, contra el promedio de su especie. */
export function waterDays(d: ChatData, p: Penguin) {
  const ds = d.dataset;
  const mine = computeActivity(ds, [p.id], ds.windowStart, d.now).daily;
  const peers = ds.penguins.filter((x) => x.speciesId === p.speciesId).map((x) => x.id);
  const species = computeActivity(ds, peers, ds.windowStart, d.now).daily;
  return mine
    .map((b, i) => ({ day: b.day, water: b.water, land: b.land, pct: share(b.water, b.land), species: share(species[i].water, species[i].land) }))
    .filter((x) => x.water + x.land > 0);
}

function waterByDay(d: ChatData, p: Penguin): string {
  const days = waterDays(d, p);
  if (!days.length) return "";
  const avg = days.reduce((a, x) => a + x.pct, 0) / days.length;
  const rows = days.map((x) => {
    const bar = "█".repeat(Math.round(x.pct * 20)).padEnd(20, "░");
    return `| ${dayFmt.format(x.day)} | ${h(x.water)} | ${h(x.land)} | **${Math.round(x.pct * 100)}%** | ${Math.round(x.species * 100)}% | \`${bar}\` |`;
  });
  return [
    `\n### En el agua, día por día (${days.length} días)`,
    `En promedio pasó **${Math.round(avg * 100)}%** de su tiempo en el agua.`,
    `| Día | Agua | Tierra | % agua | % especie | |`,
    `|---|---|---|---|---|---|`,
    ...rows,
  ].join("\n");
}

/** Reporte completo de un pingüino. */
export function penguinReport(d: ChatData, p: Penguin): string {
  const ds = d.dataset;
  const sp = SPECIES_BY_ID[p.speciesId];
  const snap = d.snapshots.get(p.id);
  const r = snap?.reading;
  const ins = d.insights.get(p.id);
  const day = computeActivity(ds, [p.id], d.now - DAY, d.now);
  const mine = perDay(d, [p.id]);
  const peers = ds.penguins.filter((x) => x.speciesId === p.speciesId).map((x) => x.id);
  const species = perDay(d, peers);
  const out: string[] = [];

  out.push(`## ${p.id}${p.name ? ` · ${p.name}` : ""}`);
  out.push(`${sp.nameEs} · ${teamName(d, p.id)}${ins ? ` · **${INSIGHT_LABEL[ins.level]}**` : ""}`);

  out.push(`\n### Ahora`);
  out.push(r ? `- ${snap ? STATUS_LABEL[snap.status] : ""} en **${zoneName(r.zoneId)}** (lectura ${dt(r.timestamp)}).` : "- Sin ubicación registrada.");

  if (ins) {
    out.push(`\n### ¿Cómo va?`);
    for (const pt of ins.points) out.push(`- ${pt.text}`);
  }

  out.push(`\n### Actividad`);
  out.push(`| | Últimas 24 h | Promedio diario | Su especie |`);
  out.push(`|---|---|---|---|`);
  out.push(`| Agua | ${h(day.totals.water)} | ${mine.water.toFixed(1)} h | ${species.water.toFixed(1)} h |`);
  out.push(`| Tierra | ${h(day.totals.land)} | ${mine.land.toFixed(1)} h | ${species.land.toFixed(1)} h |`);
  out.push(`| Sin movimiento | ${h(day.totals.stationary)} | ${mine.still.toFixed(1)} h | ${species.still.toFixed(1)} h |`);

  out.push(waterByDay(d, p));

  // Horas del día en que más nada.
  const peak = day.hourly
    .map((b, hr) => ({ hr, w: b.water }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map((x) => `${String(x.hr).padStart(2, "0")}:00`);
  if (peak.length) out.push(`\nNada sobre todo a las ${peak.join(", ")}.`);

  const zones = [...day.zoneTime.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (zones.length) out.push(`Zonas en 24 h: ${zones.map(([z, t]) => `${zoneName(z)} (${h(t)})`).join(", ")}.`);
  const moves = [...day.transitions.values()].reduce((a, b) => a + b, 0);
  out.push(`Cambió de zona ${moves} ${moves === 1 ? "vez" : "veces"} en 24 h.`);

  const cases = d.cases.filter((c) => c.penguinId === p.id);
  out.push(`\n### Seguimiento de salud`);
  if (!cases.length) out.push("- Sin casos de seguimiento.");
  for (const c of cases) {
    const last = c.entries[0];
    const w = c.entries.find((e) => e.weightKg !== undefined)?.weightKg;
    out.push(`- **${c.status === "open" ? "Abierto" : "Cerrado"}** · ${c.title} (responsable ${c.owner}, desde ${dt(c.openedAt)})${w !== undefined ? ` · último peso ${w.toFixed(2)} kg` : ""}`);
    if (last) out.push(`  - Último avance (${dt(last.at)}): ${last.text}`);
  }

  const notes = [...d.userNotes, ...ds.notes].filter((n) => n.penguinId === p.id).sort((a, b) => b.at - a.at).slice(0, 3);
  if (notes.length) {
    out.push(`\n### Notas recientes del equipo`);
    for (const n of notes) out.push(`- ${dt(n.at)}, ${n.by}: ${n.text}`);
  }
  return out.join("\n");
}

/** Tabla lado a lado de dos o más ejemplares. */
function compareReport(d: ChatData, list: Penguin[]): string {
  const rows = list.map((p) => {
    const day = computeActivity(d.dataset, [p.id], d.now - DAY, d.now).totals;
    const ins = d.insights.get(p.id);
    return `| ${p.id}${p.name ? ` · ${p.name}` : ""} | ${SPECIES_BY_ID[p.speciesId].nameEs.replace("Pingüino ", "")} | ${h(day.water)} | ${h(day.land)} | ${h(day.stationary)} | ${ins ? INSIGHT_LABEL[ins.level] : "—"} |`;
  });
  return [`### Comparación · últimas 24 h`, `| Ejemplar | Especie | Agua | Tierra | Sin movimiento | ¿Cómo va? |`, `|---|---|---|---|---|---|`, ...rows].join("\n");
}

/** Comparación contra el promedio de su especie. */
function vsSpeciesReport(d: ChatData, p: Penguin): string {
  const mine = perDay(d, [p.id]);
  const peers = d.dataset.penguins.filter((x) => x.speciesId === p.speciesId);
  const sp = perDay(d, peers.map((x) => x.id));
  const diff = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : "—");
  return [
    `### ${p.id}${p.name ? ` · ${p.name}` : ""} vs. ${SPECIES_BY_ID[p.speciesId].nameEs} (${peers.length} ejemplares)`,
    `Promedio diario en la ventana disponible:`,
    `| | ${p.id} | Especie | Diferencia |`,
    `|---|---|---|---|`,
    `| Agua | ${mine.water.toFixed(1)} h | ${sp.water.toFixed(1)} h | ${diff(mine.water, sp.water)} |`,
    `| Tierra | ${mine.land.toFixed(1)} h | ${sp.land.toFixed(1)} h | ${diff(mine.land, sp.land)} |`,
    `| Sin movimiento | ${mine.still.toFixed(1)} h | ${sp.still.toFixed(1)} h | ${diff(mine.still, sp.still)} |`,
  ].join("\n");
}

/** Lista corta de ejemplares con su dato. */
function ranking(d: ChatData, list: Penguin[], title: string, value: (p: Penguin) => number, fmt: (v: number) => string, n = 10): string {
  const rows = list
    .map((p) => ({ p, v: value(p) }))
    .sort((a, b) => a.v - b.v)
    .slice(0, n)
    .map(({ p, v }, i) => `${i + 1}. ${label(p)} · ${SPECIES_BY_ID[p.speciesId].nameEs.replace("Pingüino ", "")} · ${fmt(v)}`);
  return [`### ${title}`, ...rows].join("\n");
}

/** Filtra la colonia por especie, equipo o zona si la pregunta los nombra. */
function scope(d: ChatData, q: string): { list: Penguin[]; what: string } {
  let list = d.dataset.penguins;
  const parts: string[] = [];
  const sp = SPECIES.find((s) => q.includes(norm(s.nameEs.replace("Pingüino ", ""))) || q.includes(norm(s.nameEn.replace(" Penguin", ""))));
  if (sp) {
    list = list.filter((p) => p.speciesId === sp.id);
    parts.push(sp.nameEs.toLowerCase());
  }
  const team = d.dataset.teams.find((t) => q.includes(norm(t.name)) || q.includes(norm(t.name.replace("Team ", "equipo "))));
  if (team) {
    list = list.filter((p) => d.teamOf(p.id) === team.id);
    parts.push(team.name);
  }
  const zone = PENGUIN_ZONES.find((z) => q.includes(norm(z.name)));
  if (zone) {
    list = list.filter((p) => d.snapshots.get(p.id)?.reading?.zoneId === zone.id);
    parts.push(`en ${zone.name}`);
  }
  return { list, what: parts.length ? ` (${parts.join(", ")})` : "" };
}

const HELP = `Puedo armar reportes con la información del sistema. Prueba con:
- **Un pingüino:** «Reporte de KNG-005» o por su nombre («¿Cómo va Koda?»)
- **En el agua por día:** «% en el agua de KNG-005 por día»
- **Comparar:** «Compara GEN-001 con su especie» o «Compara KNG-005 y GEN-011»
- **La colonia:** «¿Quién nadó menos hoy?», «¿A quién hay que revisar?», «Casos de salud abiertos»
- **Por grupo:** agrega una especie, un equipo o una zona, p. ej. «¿Quién nadó menos en Team Delta?» o «¿Cuántos hay en Main Pool?»`;

/**
 * Responde una pregunta con los datos del sistema. `context` son los pingüinos de
 * la conversación (mencionados antes o abiertos en pantalla) por si la pregunta no nombra uno.
 */
export function localAnswer(d: ChatData, question: string, mentioned: Penguin[], context: Penguin[]): string {
  const q = norm(question);
  const has = (...words: string[]) => words.some((w) => q.includes(w));
  const water24 = (p: Penguin) => computeActivity(d.dataset, [p.id], d.now - DAY, d.now).totals.water;

  // Comparaciones.
  if (has("compar", " vs", "versus", "contra")) {
    const list = mentioned.length ? mentioned : context.slice(-1);
    if (list.length >= 2) return compareReport(d, list);
    if (list.length === 1) return vsSpeciesReport(d, list[0]);
  }

  // Proporción en el agua por día.
  if (has("proporc", "porcentaje", "%", "por dia", "dias") && (mentioned.length || context.length)) {
    const p = mentioned[0] ?? context[context.length - 1];
    return `## ${p.id}${p.name ? ` · ${p.name}` : ""}${waterByDay(d, p)}`;
  }

  // Un pingüino en particular.
  if (mentioned.length === 1) return penguinReport(d, mentioned[0]);
  if (mentioned.length > 1) return `${compareReport(d, mentioned)}\n\nPide «reporte de ${mentioned[0].id}» para ver uno a detalle.`;

  const { list, what } = scope(d, q);

  // Salud y seguimiento.
  if (has("caso", "seguimiento", "salud", "enferm", "lesion", "peso", "muda", "tratamiento")) {
    const open = d.cases.filter((c) => c.status === "open" && list.some((p) => p.id === c.penguinId));
    if (!open.length) return `No hay casos de seguimiento abiertos${what}.`;
    const lines = open.map((c) => {
      const p = d.dataset.penguins.find((x) => x.id === c.penguinId)!;
      return `- ${label(p)} · ${c.title} · responsable ${c.owner} · último avance: ${c.entries[0]?.text ?? "—"}`;
    });
    return [`### Casos de salud abiertos${what} (${open.length})`, ...lines].join("\n");
  }

  // Quién conviene revisar o vigilar.
  if (has("revisar", "vigilar", "atencion", "preocup", "problema", "como van", "como va la colonia")) {
    const flagged = list.filter((p) => d.insights.get(p.id)?.level !== "ok");
    if (!flagged.length) return `Todos los ejemplares${what} van dentro de lo usual en las últimas 24 h.`;
    const order = { check: 0, watch: 1, ok: 2 } as const;
    const lines = flagged
      .sort((a, b) => order[d.insights.get(a.id)!.level] - order[d.insights.get(b.id)!.level])
      .map((p) => {
        const ins = d.insights.get(p.id)!;
        return `- ${label(p)} · **${INSIGHT_LABEL[ins.level]}** · ${ins.points[0]?.text ?? ""}`;
      });
    const ok = list.length - flagged.length;
    return [`### ¿Cómo van?${what}`, `${ok} de ${list.length} van bien. Conviene mirar a estos:`, ...lines].join("\n");
  }

  // Rankings de agua y movimiento.
  if (has("menos") && has("agua", "nad")) return ranking(d, list, `Menos tiempo en el agua · últimas 24 h${what}`, water24, (v) => h(v));
  if (has("mas", "más") && has("agua", "nad")) return ranking(d, list, `Más tiempo en el agua · últimas 24 h${what}`, (p) => -water24(p), (v) => h(-v));
  if (has("quiet", "sin movimiento", "inmovil", "descans")) {
    const still = (p: Penguin) => -computeActivity(d.dataset, [p.id], d.now - DAY, d.now).totals.stationary;
    return ranking(d, list, `Más tiempo sin movimiento · últimas 24 h${what}`, still, (v) => h(-v));
  }

  // Conteos y dónde están.
  if (has("cuantos", "cuántos", "donde", "dónde", "resumen", "colonia", "zona")) {
    const byZone = new Map<string, number>();
    let water = 0;
    for (const p of list) {
      const s = d.snapshots.get(p.id);
      if (s?.status === "water") water++;
      const z = s?.reading?.zoneId;
      if (z) byZone.set(z, (byZone.get(z) ?? 0) + 1);
    }
    const zones = [...byZone.entries()].sort((a, b) => b[1] - a[1]).map(([z, n]) => `| ${zoneName(z)} | ${n} |`);
    return [`### Colonia${what}: ${list.length} ejemplares`, `${water} en el agua y ${list.length - water} en tierra ahora mismo.`, `| Zona | Ejemplares |`, `|---|---|`, ...zones].join("\n");
  }

  // Seguir con el pingüino de la conversación.
  if (context.length) return penguinReport(d, context[context.length - 1]);
  return HELP;
}
