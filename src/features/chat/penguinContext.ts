/**
 * Turns the demo's simulated data into text for the reports chat:
 * a short roster of the whole colony and a detailed dossier per penguin.
 * Everything comes from the Dataset's readings, gaps and segments, same as the screens.
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

const dtFmt = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "2-digit", month: "short" });
const dt = (ts: number) => dtFmt.format(ts);
const h = (ms: number) => `${(ms / HOUR).toFixed(1)} h`;
const zoneName = (id: string) => ZONE_BY_ID[id]?.name ?? id;
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

function teamLabel(d: ChatData, penguinId: string) {
  const t = d.dataset.teams.find((x) => x.id === d.teamOf(penguinId));
  return t ? `${t.name} (lead: ${t.lead})` : "no team";
}

/** One line per penguin: enough to compare or to work out which one the user means. */
export function colonyRoster(d: ChatData): string {
  const lines = ["code | name | species | team | status | zone | last reading"];
  for (const p of d.dataset.penguins) {
    const s = d.snapshots.get(p.id);
    const r = s?.reading;
    lines.push(
      [
        p.id,
        p.name ?? "—",
        SPECIES_BY_ID[p.speciesId].nameEn,
        d.dataset.teams.find((t) => t.id === d.teamOf(p.id))?.name ?? "—",
        s ? STATUS_LABEL[s.status] : "No data",
        r ? zoneName(r.zoneId) : "—",
        r ? `${Math.round(s!.ageMin)} min ago` : "—",
      ].join(" | "),
    );
  }
  return `Readings as of: ${dt(d.now)}. ${d.dataset.penguins.length} birds.\n${lines.join("\n")}`;
}

function breakdownLine(b: Breakdown) {
  const tracked = b.water + b.land;
  return `water ${h(b.water)} (${pct(b.water, tracked)}), land ${h(b.land)} (of which no movement ${h(b.stationary)}), ${b.readings} readings`;
}

/** Detailed dossier of one penguin with everything the demo knows about it. */
export function penguinDossier(d: ChatData, p: Penguin): string {
  const { dataset: ds, now } = d;
  const sp = SPECIES_BY_ID[p.speciesId];
  const snap = d.snapshots.get(p.id);
  const device = ds.devices.find((x) => x.id === p.deviceId);
  const out: string[] = [];

  out.push(`## ${p.id}${p.name ? ` · ${p.name}` : ""}`);
  out.push(`Species: ${sp.nameEn} (${sp.scientific}). Team: ${teamLabel(d, p.id)}.`);
  out.push(`Registered: ${dt(p.registeredAt)}. Record: ${p.recordStatus}. Band: ${p.bandColor}. Last team review: ${dt(d.lastReviewOf(p.id))}.`);
  if (device) out.push(`Device: ${device.id}.`);

  if (snap) {
    const r = snap.reading;
    out.push(
      `Current status: ${STATUS_LABEL[snap.status]}.` +
        (r
          ? ` Last reading ${dt(r.timestamp)} (${Math.round(snap.ageMin)} min ago) in ${zoneName(r.zoneId)}, medium ${r.medium === "water" ? "water" : "land"}, position (${(r.x / ds.habitat.unitsPerMeter).toFixed(1)} m, ${(r.y / ds.habitat.unitsPerMeter).toFixed(1)} m), accuracy ±${r.accuracyM} m, source ${r.source}, quality ${r.quality}.`
          : " No readings."),
    );
  }

  const ins = d.insights.get(p.id);
  if (ins) {
    out.push(`\n### How is it doing? (the demo's automatic indicator): ${INSIGHT_LABEL[ins.level]}`);
    for (const pt of ins.points) out.push(`- ${pt.text}`);
  }

  const cases = d.cases.filter((c) => c.penguinId === p.id);
  out.push(`\n### Health follow-up (${cases.length} cases)`);
  for (const c of cases) {
    out.push(`- ${c.status === "open" ? "OPEN" : "Closed"} · ${c.title} (reason: ${c.reason}, owner: ${c.owner}, opened ${dt(c.openedAt)}${c.closedAt ? `, closed ${dt(c.closedAt)}` : ""})`);
    for (const e of [...c.entries].reverse()) out.push(`  - ${dt(e.at)}, ${e.by}: ${e.text}${e.weightKg !== undefined ? ` [weight ${e.weightKg} kg]` : ""}`);
  }

  // Activity: last 24 h, the full available window, and the species average.
  const from = Math.max(ds.windowStart, p.registeredAt);
  const last24 = computeActivity(ds, [p.id], now - DAY, now);
  const all = computeActivity(ds, [p.id], from, now);
  const peers = ds.penguins.filter((x) => x.speciesId === p.speciesId).map((x) => x.id);
  const species = computeActivity(ds, peers, from, now);
  const avg = (k: keyof Breakdown) => species.totals[k] / Math.max(1, peers.length);
  const days = Math.max(1, (now - from) / DAY);

  out.push(`\n### Activity`);
  out.push(`Last 24 h: ${breakdownLine(last24.totals)}.`);
  out.push(`Full window (${days.toFixed(1)} days since ${dt(from)}): ${breakdownLine(all.totals)}.`);
  out.push(
    `Daily average for this bird vs. its species (${peers.length} birds, same period): water ${h(all.totals.water / days)} vs ${h(avg("water") / days)}, land ${h(all.totals.land / days)} vs ${h(avg("land") / days)}, no movement ${h(all.totals.stationary / days)} vs ${h(avg("stationary") / days)}.`,
  );

  out.push(`\nBy day (water / land / no movement):`);
  for (const b of all.daily) out.push(`- ${dayFmt.format(b.day)}: ${h(b.water)} / ${h(b.land)} / ${h(b.stationary)}`);

  out.push(`\nBy hour of day, full window (water / land):`);
  out.push(all.hourly.map((b, i) => `${String(i).padStart(2, "0")}h ${h(b.water)}/${h(b.land)}`).join(" · "));

  const zones = [...all.zoneTime.entries()].sort((a, b) => b[1] - a[1]);
  out.push(`\nTime by zone: ${zones.map(([z, t]) => `${zoneName(z)} ${h(t)}`).join(", ") || "—"}.`);
  const moves = [...all.transitions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  out.push(`Most frequent zone changes: ${moves.map(([k, n]) => `${k.split(">").map(zoneName).join(" → ")} (${n})`).join(", ") || "none observed"}.`);

  // Path over the last 24 h, as continuous segments.
  const recs = (ds.activity.get(p.id) ?? []).filter((r) => r.end > now - DAY);
  out.push(`\n### Path, last 24 h (${recs.length} segments)`);
  for (const r of recs.slice(-60)) {
    out.push(`- ${dt(r.start)}–${dt(r.end)}: ${r.medium === "water" ? "water" : "land"} in ${zoneName(r.zoneId)}${r.stationary ? ", no movement" : ""} (${r.readings} readings)`);
  }

  const notes = [...d.userNotes, ...ds.notes].filter((n) => n.penguinId === p.id).sort((a, b) => b.at - a.at);
  out.push(`\n### Team notes (${notes.length})`);
  for (const n of notes.slice(0, 20)) out.push(`- ${dt(n.at)}, ${n.by}: ${n.text}`);

  const incidents = [...d.log, ...ds.incidents].filter((i) => i.penguinId === p.id).sort((a, b) => b.at - a.at);
  if (incidents.length) {
    out.push(`\n### Log (${incidents.length})`);
    for (const i of incidents.slice(0, 20)) out.push(`- ${dt(i.at)}: ${i.text}`);
  }

  return out.join("\n");
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Penguins a text mentions, by code (KNG-005) or by full name. */
export function mentionedPenguins(penguins: Penguin[], text: string): Penguin[] {
  const t = norm(text);
  const codes = new Set((text.toUpperCase().match(/\b[A-Z]{3}-\d{3}\b/g) ?? []));
  return penguins.filter((p) => codes.has(p.id) || (p.name && p.name.length > 2 && new RegExp(`\\b${norm(p.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t)));
}
