/**
 * Simulated scenario generator.
 *
 * Produces a complete, consistent Dataset from a seed and a reference time
 * ("now"). Everything produced here is fictional: readings carry
 * `simulated: true` and the UI says so.
 *
 * Consistency rules it follows:
 * - Unique IDs per penguin and per device.
 * - Each penguin belongs to exactly one team.
 * - Readings are in chronological order and never before admission.
 * - There is no fine position underwater: the source is acoustic and accuracy is lower.
 * - Missing readings are recorded as a gap with its cause
 *   (no fix vs. no signal); they are never filled in by interpolation.
 */
import type { DemoConfig } from "@/config/demo.config";
import { HABITAT, ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES } from "@/domain/species";
import { DEFAULT_TEAM_BY_SPECIES, TEAMS } from "@/domain/teams";
import type {
  ActivityRecord,
  CareNote,
  Dataset,
  DeviceProfile,
  Incident,
  LocationReading,
  Penguin,
  ReadingGap,
  ReadingQuality,
  ReadingSource,
  SpeciesId,
  TrackingDevice,
} from "@/domain/types";
import { bbox, pointInPolygon, shrink, type Pt } from "@/logic/geometry";
import { between, chance, hashSeed, mulberry32, pick, type Rng } from "@/logic/rng";
import { DAY, MIN } from "@/logic/time";

interface Behavior {
  land: string[];
  water: string[];
  feeding: string;
  waterAffinity: number;
}

const BEHAVIOR: Record<SpeciesId, Behavior> = {
  king: { land: ["snow-beach", "ice-ridge"], water: ["main-pool"], feeding: "feeding-north", waterAffinity: 0.3 },
  gentoo: { land: ["snow-beach", "pebble-beach"], water: ["main-pool", "deep-dive"], feeding: "feeding-north", waterAffinity: 0.45 },
  rockhopper: { land: ["nesting-rocks", "observation-ledge"], water: ["wading-shore", "main-pool"], feeding: "feeding-south", waterAffinity: 0.28 },
  macaroni: { land: ["nesting-rocks", "ice-ridge"], water: ["deep-dive"], feeding: "feeding-north", waterAffinity: 0.34 },
  chinstrap: { land: ["pebble-beach", "ice-ridge"], water: ["main-pool", "wading-shore"], feeding: "feeding-south", waterAffinity: 0.38 },
  adelie: { land: ["pebble-beach", "snow-beach"], water: ["wading-shore", "main-pool"], feeding: "feeding-south", waterAffinity: 0.4 },
};

const BAND_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#f8fafc"];

const NOTE_TEXTS = [
  "Took part in the morning feeding session.",
  "Routine visual check logged.",
  "Scheduled weigh-in completed.",
  "Tag attachment checked.",
  "Seen interacting normally with the group.",
  "ID band change logged.",
  "Took part in the afternoon feeding session.",
  "Scale-approach training session completed.",
];

/** Fictional names. Assigned without repeats within each species. */
const PENGUIN_NAMES = [
  "Aurora", "Atlas", "Nami", "Luna", "Kai", "Sol", "Mako", "Tara", "Nilo", "Breeze", "Coral", "Dante", "Elio", "Frida", "Gala", "Frost",
  "Iris", "Jade", "Koda", "Lumi", "Milo", "Cloud", "Oslo", "Pearl", "Quila", "Rocco", "Sami", "Tobi", "Umi", "Vega", "Wilo", "Yuki",
  "Sapphire", "Alba", "Bruno", "Sky", "Duna", "Eco", "Beacon", "Gris", "Halo", "Indi", "Juno", "Kiwi", "Lake", "Marina", "Snow", "Wave",
  "Pipo", "Runa", "Sora", "Tundra", "Valo", "Arctic", "Bora", "Cora", "Delta", "Fjord", "Glacier", "Pingo",
];

/**
 * Name for each penguin. Uses its own generator so readings generated with
 * the same seed don't change; ~1 in 8 stays unnamed.
 */
function namesFor(seed: number, speciesId: string, count: number): (string | undefined)[] {
  const rng = mulberry32(hashSeed(seed, "names", speciesId));
  const pool = [...PENGUIN_NAMES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: count }, (_, i) => (rng() < 0.12 ? undefined : pool[i % pool.length]));
}

const samplers = new Map<string, Pt[]>();
function randomPointIn(rng: Rng, zoneId: string): Pt {
  const zone = ZONE_BY_ID[zoneId];
  let poly = samplers.get(zoneId);
  if (!poly) {
    poly = shrink(zone.polygon, 0.8);
    samplers.set(zoneId, poly);
  }
  const b = bbox(poly);
  for (let i = 0; i < 60; i++) {
    const x = b.minX + rng() * b.w;
    const y = b.minY + rng() * b.h;
    if (pointInPolygon(x, y, poly)) return [x, y];
  }
  return [b.minX + b.w / 2, b.minY + b.h / 2];
}

function jitterIn(rng: Rng, zoneId: string, [x, y]: Pt, spread: number): Pt {
  const poly = samplers.get(zoneId) ?? shrink(ZONE_BY_ID[zoneId].polygon, 0.8);
  for (let i = 0; i < 8; i++) {
    const nx = x + (rng() - 0.5) * 2 * spread;
    const ny = y + (rng() - 0.5) * 2 * spread;
    if (pointInPolygon(nx, ny, poly)) return [nx, ny];
  }
  return randomPointIn(rng, zoneId);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function generateDataset(config: DemoConfig, now: number): Dataset {
  const slot = config.slotMinutes * MIN;
  const slots = Math.round((config.historyDays * DAY) / slot);
  const windowStart = now - (slots - 1) * slot;
  const upm = HABITAT.unitsPerMeter;

  const penguins: Penguin[] = [];
  const devices: TrackingDevice[] = [];
  const readings = new Map<string, LocationReading[]>();
  const gaps = new Map<string, ReadingGap[]>();
  const activity = new Map<string, ActivityRecord[]>();
  const notes: CareNote[] = [];
  const incidents: Incident[] = [];
  const vetPenguins: string[] = [];

  for (const sp of SPECIES) {
    const count = Math.max(0, Math.floor(config.speciesCounts[sp.id] ?? 0));
    const beh = BEHAVIOR[sp.id];
    const names = namesFor(config.seed, sp.id, count);
    for (let i = 1; i <= count; i++) {
      const rng = mulberry32(hashSeed(config.seed, sp.id, i));
      const id = `${sp.code}-${String(i).padStart(3, "0")}`;
      const deviceId = `TAG-${sp.code[0]}${String(hashSeed(id) % 9000 + 1000)}`;

      // Fictional admission date: most years ago, a few recently admitted.
      const recent = chance(rng, 0.04);
      const registeredAt = recent
        ? Math.floor((now - between(rng, 2, 9) * DAY) / slot) * slot
        : Math.floor((now - between(rng, 400, 2600) * DAY) / DAY) * DAY;

      const isVet = chance(rng, config.vetShare);
      const teamId = isVet ? "vet" : DEFAULT_TEAM_BY_SPECIES[sp.id];
      if (isVet) vetPenguins.push(id);

      // In the demo every device works. The random draws are kept so the rest
      // of the scenario (names, trajectories) doesn't change.
      rng();
      const profile: DeviceProfile = "stable";
      between(rng, 7, 40);

      const lastReviewAt = isVet
        ? now - between(rng, 0.2, 3) * DAY
        : now - Math.pow(rng(), 2.2) * 12.5 * DAY;

      penguins.push({
        id,
        name: names[i - 1],
        speciesId: sp.id,
        registeredAt,
        recordStatus: recent ? "recent" : "active",
        deviceId,
        bandColor: pick(rng, BAND_COLORS),
        lastReviewAt,
        initialTeamId: teamId,
      });

      devices.push({
        id: deviceId,
        penguinId: id,
        profile,
        lastHeartbeat: now - between(rng, 0.5, 8) * MIN,
        batteryPct: Math.round(between(rng, 45, 98)),
      });

      // --- Simulated trajectory ---
      const list: LocationReading[] = [];
      let medium: "water" | "land" = "land";
      let zoneId = pick(rng, beh.land);
      let restZone = zoneId;
      let pos = randomPointIn(rng, zoneId);
      let restPos = pos;
      let reported: Pt = pos;
      const firstSlot = Math.max(0, Math.ceil((registeredAt - windowStart) / slot));

      for (let s = firstSlot; s < slots; s++) {
        const t = windowStart + s * slot;
        const d = new Date(t);
        const h = d.getHours() + d.getMinutes() / 60;
        const night = h >= 21.5 || h < 6.5;
        const feedingTime = (h >= 9 && h < 10) || (h >= 15 && h < 16);
        const prevZone = zoneId;
        let stationary = false;

        if (night) {
          if (medium === "water" && chance(rng, 0.8)) {
            medium = "land";
            zoneId = restZone;
          } else if (medium === "land" && zoneId !== restZone && chance(rng, 0.6)) {
            zoneId = restZone;
          }
          if (zoneId === restZone && prevZone === restZone) stationary = chance(rng, 0.92);
          if (zoneId === restZone && prevZone !== restZone) pos = restPos;
        } else if (feedingTime && chance(rng, 0.65)) {
          medium = "land";
          zoneId = beh.feeding;
        } else if (isVet && medium === "land" && chance(rng, 0.3)) {
          zoneId = chance(rng, 0.12) ? "vet-holding" : "care-bay";
        } else {
          if (medium === "water") {
            if (!chance(rng, 0.62)) {
              medium = "land";
              zoneId = pick(rng, beh.land);
            } else if (!chance(rng, 0.8)) zoneId = pick(rng, beh.water);
          } else {
            if (chance(rng, beh.waterAffinity * 0.55)) {
              medium = "water";
              zoneId = pick(rng, beh.water);
            } else if (ZONE_BY_ID[zoneId].kind !== "land" || !chance(rng, 0.8)) {
              zoneId = pick(rng, beh.land);
            }
          }
          if (medium === "land" && prevZone === zoneId) stationary = chance(rng, 0.35);
        }

        // The overnight resting spot changes now and then.
        if (!night && medium === "land" && ZONE_BY_ID[zoneId].kind === "land" && chance(rng, 0.03)) {
          restZone = zoneId;
          restPos = randomPointIn(rng, zoneId);
        }

        if (zoneId !== prevZone) {
          pos = randomPointIn(rng, zoneId);
          stationary = false;
        } else if (!stationary) {
          pos = jitterIn(rng, zoneId, pos, medium === "water" ? 90 : 30);
        }

        // Every interval has a reading: devices never fail in the demo.
        if (zoneId === "deep-dive") chance(rng, 0.1);
        chance(rng, 0.015);

        const zone = ZONE_BY_ID[zoneId];
        let source: ReadingSource;
        let quality: ReadingQuality;
        let accuracyM: number;
        if (zone.medium === "water") {
          source = "acoustic";
          quality = zoneId === "deep-dive" ? "low" : "medium";
          accuracyM = zoneId === "deep-dive" ? between(rng, 3.5, 7) : between(rng, 1.5, 3.5);
        } else if (zone.kind === "feeding" && chance(rng, 0.6)) {
          source = "rfid_gate";
          quality = "high";
          accuracyM = 1.5;
        } else {
          source = "uwb";
          quality = chance(rng, 0.08) ? "medium" : "high";
          accuracyM = quality === "high" ? between(rng, 0.2, 0.6) : between(rng, 0.8, 1.6);
        }
        if (!stationary || list.length === 0) {
          const noise = accuracyM * upm * 0.5;
          reported = [pos[0] + (rng() - 0.5) * noise, pos[1] + (rng() - 0.5) * noise];
        }
        list.push({
          penguinId: id,
          deviceId,
          timestamp: t,
          zoneId,
          x: round1(reported[0]),
          y: round1(reported[1]),
          accuracyM: round1(accuracyM),
          source,
          quality,
          medium: zone.medium,
          simulated: true,
        });
      }
      readings.set(id, list);
      gaps.set(id, []);
      activity.set(id, buildActivity(list, slot));

      // --- Fictional care records ---
      const nNotes = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < nNotes; k++) {
        const at = now - between(rng, 0.3, config.historyDays) * DAY;
        if (at < registeredAt) continue;
        notes.push({ id: `NOTE-${id}-${k}`, penguinId: id, at, by: pick(rng, TEAMS.find((t) => t.id === teamId)!.members), text: pick(rng, NOTE_TEXTS), simulated: true });
      }
      incidents.push({ id: `INC-${id}-reg`, penguinId: id, at: registeredAt, kind: "registry", text: "Added to the registry." });
      incidents.push({ id: `INC-${id}-rev`, penguinId: id, at: lastReviewAt, kind: "care", text: "Routine check completed." });
      if (!recent && chance(rng, 0.12)) between(rng, 20, 200);
    }
  }

  notes.sort((a, b) => b.at - a.at);
  incidents.sort((a, b) => b.at - a.at);

  return {
    generatedAt: now,
    now,
    windowStart,
    slotMinutes: config.slotMinutes,
    habitat: HABITAT,
    species: SPECIES,
    teams: TEAMS,
    penguins,
    devices,
    readings,
    gaps,
    activity,
    notes,
    incidents,
  };
}

function buildActivity(list: LocationReading[], slot: number): ActivityRecord[] {
  const out: ActivityRecord[] = [];
  let cur: ActivityRecord | null = null;
  let lastX = 0, lastY = 0;
  for (const r of list) {
    if (cur && cur.zoneId === r.zoneId && cur.medium === r.medium && r.timestamp - cur.end <= 0) {
      cur.end = r.timestamp + slot;
      cur.readings++;
      if (r.x !== lastX || r.y !== lastY) cur.stationary = false;
    } else {
      if (cur) out.push(cur);
      cur = { penguinId: r.penguinId, start: r.timestamp, end: r.timestamp + slot, medium: r.medium, zoneId: r.zoneId, readings: 1, stationary: true };
    }
    lastX = r.x;
    lastY = r.y;
  }
  if (cur) out.push(cur);
  return out;
}
