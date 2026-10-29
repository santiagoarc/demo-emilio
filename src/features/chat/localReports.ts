/**
 * Chat answers built from the system's own data, with no external services:
 * a penguin report, comparisons and colony questions.
 * Uses the same figures as the screens (computeActivity, insights, cases).
 * Understands English questions (and the common Spanish keywords too).
 */
import { PENGUIN_ZONES, ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES, SPECIES_BY_ID } from "@/domain/species";
import type { Penguin } from "@/domain/types";
import { INSIGHT_LABEL } from "@/logic/insights";
import { computeActivity } from "@/logic/metrics";
import { STATUS_LABEL } from "@/logic/status";
import { DAY, HOUR } from "@/logic/time";
import type { ChatData } from "./penguinContext";

const dtFmt = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const dt = (ts: number) => dtFmt.format(ts);
const h = (ms: number) => `${(ms / HOUR).toFixed(1)} h`;
const zoneName = (id: string) => ZONE_BY_ID[id]?.name ?? id;
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-word (or whole-phrase) match, so "king" doesn't fire on "looking". */
const hasWord = (q: string, w: string) => new RegExp(`\\b${escape(w)}\\b`).test(q);
const label = (p: Penguin) => `**${p.id}**${p.name ? ` (${p.name})` : ""}`;
const shortSpecies = (p: Penguin) => SPECIES_BY_ID[p.speciesId].nameEn.replace(/ Penguin$/, "");
const teamName = (d: ChatData, id: string) => d.dataset.teams.find((t) => t.id === d.teamOf(id))?.name ?? "no team";

/** Water and land per day for a group of birds over the available window. */
function perDay(d: ChatData, ids: string[]) {
  const from = d.dataset.windowStart;
  const days = Math.max(1, (d.now - from) / DAY);
  const t = computeActivity(d.dataset, ids, from, d.now).totals;
  const n = Math.max(1, ids.length);
  return { water: t.water / days / n, land: t.land / days / n, still: t.stationary / days / n };
}

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "2-digit", month: "short" });
const share = (water: number, land: number) => (water + land > 0 ? water / (water + land) : 0);

/** Share of time in the water, day by day, against the species average. */
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
    `\n### Time in water, day by day (${days.length} days)`,
    `On average it spent **${Math.round(avg * 100)}%** of its tracked time in the water.`,
    `| Day | Water | Land | % water | % species | |`,
    `|---|---|---|---|---|---|`,
    ...rows,
  ].join("\n");
}

/** Full report on one penguin. */
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
  out.push(`${sp.nameEn} · ${teamName(d, p.id)}${ins ? ` · **${INSIGHT_LABEL[ins.level]}**` : ""}`);

  out.push(`\n### Right now`);
  out.push(r ? `- ${snap ? STATUS_LABEL[snap.status] : ""} in **${zoneName(r.zoneId)}** (reading at ${dt(r.timestamp)}).` : "- No location recorded.");

  if (ins) {
    out.push(`\n### How is it doing?`);
    for (const pt of ins.points) out.push(`- ${pt.text}`);
  }

  out.push(`\n### Activity`);
  out.push(`| | Last 24 h | Daily average | Species average |`);
  out.push(`|---|---|---|---|`);
  out.push(`| Water | ${h(day.totals.water)} | ${mine.water.toFixed(1)} h | ${species.water.toFixed(1)} h |`);
  out.push(`| Land | ${h(day.totals.land)} | ${mine.land.toFixed(1)} h | ${species.land.toFixed(1)} h |`);
  out.push(`| No movement | ${h(day.totals.stationary)} | ${mine.still.toFixed(1)} h | ${species.still.toFixed(1)} h |`);

  out.push(waterByDay(d, p));

  // Hours of the day when it swims the most.
  const peak = day.hourly
    .map((b, hr) => ({ hr, w: b.water }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map((x) => `${String(x.hr).padStart(2, "0")}:00`);
  if (peak.length) out.push(`\nMost of its swimming happens around ${peak.join(", ")}.`);

  const zones = [...day.zoneTime.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (zones.length) out.push(`Zones in the last 24 h: ${zones.map(([z, t]) => `${zoneName(z)} (${h(t)})`).join(", ")}.`);
  const moves = [...day.transitions.values()].reduce((a, b) => a + b, 0);
  out.push(`Changed zones ${moves} ${moves === 1 ? "time" : "times"} in the last 24 h.`);

  const cases = d.cases.filter((c) => c.penguinId === p.id);
  out.push(`\n### Health follow-up`);
  if (!cases.length) out.push("- No follow-up cases.");
  for (const c of cases) {
    const last = c.entries[0];
    const w = c.entries.find((e) => e.weightKg !== undefined)?.weightKg;
    out.push(`- **${c.status === "open" ? "Open" : "Closed"}** · ${c.title} (owner ${c.owner}, since ${dt(c.openedAt)})${w !== undefined ? ` · latest weight ${w.toFixed(2)} kg` : ""}`);
    if (last) out.push(`  - Latest update (${dt(last.at)}): ${last.text}`);
  }

  const notes = [...d.userNotes, ...ds.notes].filter((n) => n.penguinId === p.id).sort((a, b) => b.at - a.at).slice(0, 3);
  if (notes.length) {
    out.push(`\n### Recent team notes`);
    for (const n of notes) out.push(`- ${dt(n.at)}, ${n.by}: ${n.text}`);
  }
  return out.join("\n");
}

/** Side-by-side table of two or more birds. */
function compareReport(d: ChatData, list: Penguin[]): string {
  const rows = list.map((p) => {
    const day = computeActivity(d.dataset, [p.id], d.now - DAY, d.now).totals;
    const ins = d.insights.get(p.id);
    return `| ${p.id}${p.name ? ` · ${p.name}` : ""} | ${shortSpecies(p)} | ${h(day.water)} | ${h(day.land)} | ${h(day.stationary)} | ${ins ? INSIGHT_LABEL[ins.level] : "—"} |`;
  });
  return [`### Comparison · last 24 h`, `| Bird | Species | Water | Land | No movement | How is it doing? |`, `|---|---|---|---|---|---|`, ...rows].join("\n");
}

/** Comparison against the species average. */
function vsSpeciesReport(d: ChatData, p: Penguin): string {
  const mine = perDay(d, [p.id]);
  const peers = d.dataset.penguins.filter((x) => x.speciesId === p.speciesId);
  const sp = perDay(d, peers.map((x) => x.id));
  const diff = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : "—");
  return [
    `### ${p.id}${p.name ? ` · ${p.name}` : ""} vs. ${SPECIES_BY_ID[p.speciesId].nameEn} average (${peers.length} birds)`,
    `Daily average over the available window:`,
    `| | ${p.id} | Species | Difference |`,
    `|---|---|---|---|`,
    `| Water | ${mine.water.toFixed(1)} h | ${sp.water.toFixed(1)} h | ${diff(mine.water, sp.water)} |`,
    `| Land | ${mine.land.toFixed(1)} h | ${sp.land.toFixed(1)} h | ${diff(mine.land, sp.land)} |`,
    `| No movement | ${mine.still.toFixed(1)} h | ${sp.still.toFixed(1)} h | ${diff(mine.still, sp.still)} |`,
  ].join("\n");
}

/** Short list of birds with their value. */
function ranking(d: ChatData, list: Penguin[], title: string, value: (p: Penguin) => number, fmt: (v: number) => string, n = 10): string {
  const rows = list
    .map((p) => ({ p, v: value(p) }))
    .sort((a, b) => a.v - b.v)
    .slice(0, n)
    .map(({ p, v }, i) => `${i + 1}. ${label(p)} · ${shortSpecies(p)} · ${fmt(v)}`);
  return [`### ${title}`, ...rows].join("\n");
}

/** Narrows the colony by species, team or zone if the question names one. */
function scope(d: ChatData, q: string): { list: Penguin[]; what: string } {
  let list = d.dataset.penguins;
  const parts: string[] = [];
  const sp = SPECIES.find((s) => hasWord(q, norm(s.nameEn.replace(/ Penguin$/, ""))) || hasWord(q, norm(s.nameEs.replace("Pingüino ", ""))));
  if (sp) {
    list = list.filter((p) => p.speciesId === sp.id);
    parts.push(`${sp.nameEn}s`);
  }
  const team = d.dataset.teams.find((t) => hasWord(q, norm(t.name)) || hasWord(q, norm(t.name.replace("Team ", "equipo "))));
  if (team) {
    list = list.filter((p) => d.teamOf(p.id) === team.id);
    parts.push(team.name);
  }
  const zone = PENGUIN_ZONES.find((z) => q.includes(norm(z.name)));
  if (zone) {
    list = list.filter((p) => d.snapshots.get(p.id)?.reading?.zoneId === zone.id);
    parts.push(`in ${zone.name}`);
  }
  return { list, what: parts.length ? ` (${parts.join(", ")})` : "" };
}

const HELP = `I can build reports from the system's data. Try:
- **One penguin:** "Report on KNG-005" or by name ("How is Koda doing?")
- **Time in water by day:** "% time in water by day for KNG-005"
- **Compare:** "Compare GEN-001 with its species" or "Compare KNG-005 and GEN-011"
- **The colony:** "Who spent the least time in water today?", "Who should we check?", "Open health cases"
- **By group:** add a species, team or zone, e.g. "Least time in water in Team Delta" or "How many are in Main Pool?"`;

/**
 * Answers a question with the system's data. `context` holds the penguins from the
 * conversation (mentioned earlier or open on screen) in case the question doesn't name one.
 */
export function localAnswer(d: ChatData, question: string, mentioned: Penguin[], context: Penguin[]): string {
  const q = norm(question);
  const has = (...words: string[]) => words.some((w) => q.includes(w));
  const water24 = (p: Penguin) => computeActivity(d.dataset, [p.id], d.now - DAY, d.now).totals.water;
  const aboutWater = has("water", "swim", "agua", "nad");

  // Comparisons.
  if (has("compar", " vs", "versus", "against", "contra")) {
    const list = mentioned.length ? mentioned : context.slice(-1);
    if (list.length >= 2) return compareReport(d, list);
    if (list.length === 1) return vsSpeciesReport(d, list[0]);
  }

  // Share of time in the water by day.
  if (has("%", "percent", "proportion", "share", "by day", "per day", "each day", "daily", "day by day", "proporc", "porcentaje", "por dia", "dias") && (mentioned.length || context.length)) {
    const p = mentioned[0] ?? context[context.length - 1];
    return `## ${p.id}${p.name ? ` · ${p.name}` : ""}${waterByDay(d, p)}`;
  }

  // One specific penguin.
  if (mentioned.length === 1) return penguinReport(d, mentioned[0]);
  if (mentioned.length > 1) return `${compareReport(d, mentioned)}\n\nAsk for "report on ${mentioned[0].id}" to see one in detail.`;

  const { list, what } = scope(d, q);

  // Health and follow-up.
  if (has("case", "follow-up", "follow up", "health", "sick", "injur", "weight", "molt", "treatment", "medical", "vet", "caso", "seguimiento", "salud", "enferm", "lesion", "peso", "muda", "tratamiento")) {
    const open = d.cases.filter((c) => c.status === "open" && list.some((p) => p.id === c.penguinId));
    if (!open.length) return `No open follow-up cases${what}.`;
    const lines = open.map((c) => {
      const p = d.dataset.penguins.find((x) => x.id === c.penguinId)!;
      return `- ${label(p)} · ${c.title} · owner ${c.owner} · latest update: ${c.entries[0]?.text ?? "—"}`;
    });
    return [`### Open health cases${what} (${open.length})`, ...lines].join("\n");
  }

  // Who's worth checking or watching.
  if (has("check", "watch", "attention", "concern", "worr", "problem", "flag", "look at", "keep an eye", "how is the colony", "how's the colony", "how are they", "how are the", "revisar", "vigilar", "atencion", "preocup", "problema", "como van", "como va la colonia")) {
    const flagged = list.filter((p) => d.insights.get(p.id)?.level !== "ok");
    if (!flagged.length) return `All birds${what} are within their usual range over the last 24 h.`;
    const order = { check: 0, watch: 1, ok: 2 } as const;
    const lines = flagged
      .sort((a, b) => order[d.insights.get(a.id)!.level] - order[d.insights.get(b.id)!.level])
      .map((p) => {
        const ins = d.insights.get(p.id)!;
        return `- ${label(p)} · **${INSIGHT_LABEL[ins.level]}** · ${ins.points[0]?.text ?? ""}`;
      });
    const ok = list.length - flagged.length;
    return [`### How are they doing?${what}`, `${ok} of ${list.length} are doing fine. Worth a look:`, ...lines].join("\n");
  }

  // Water and movement rankings.
  if (has("least", "less", "fewest", "lowest", "shortest", "menos") && aboutWater) return ranking(d, list, `Least time in water · last 24 h${what}`, water24, (v) => h(v));
  if ((has("most", "more", "highest", "longest", "top") || hasWord(q, "mas")) && aboutWater) return ranking(d, list, `Most time in water · last 24 h${what}`, (p) => -water24(p), (v) => h(-v));
  if (has("quiet", "still", "stationary", "inactive", "idle", "resting", "not moving", "sin movimiento", "inmovil", "descans")) {
    const still = (p: Penguin) => -computeActivity(d.dataset, [p.id], d.now - DAY, d.now).totals.stationary;
    return ranking(d, list, `Most time without movement · last 24 h${what}`, still, (v) => h(-v));
  }

  // Counts and where they are.
  if (has("how many", "count", "where", "summary", "overview", "colony", "zone", "cuantos", "donde", "resumen", "colonia", "zona")) {
    const byZone = new Map<string, number>();
    let water = 0;
    for (const p of list) {
      const s = d.snapshots.get(p.id);
      if (s?.status === "water") water++;
      const z = s?.reading?.zoneId;
      if (z) byZone.set(z, (byZone.get(z) ?? 0) + 1);
    }
    const zones = [...byZone.entries()].sort((a, b) => b[1] - a[1]).map(([z, n]) => `| ${zoneName(z)} | ${n} |`);
    return [`### Colony${what}: ${list.length} birds`, `${water} in the water and ${list.length - water} on land right now.`, `| Zone | Birds |`, `|---|---|`, ...zones].join("\n");
  }

  // Continue with the penguin from the conversation.
  if (context.length) return penguinReport(d, context[context.length - 1]);
  return HELP;
}
