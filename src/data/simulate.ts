/**
 * Generador del escenario simulado.
 *
 * Produce un Dataset completo y coherente a partir de una semilla y una hora de
 * referencia ("ahora"). Todo lo que sale de aquí es ficticio: las lecturas
 * llevan `simulated: true` y la interfaz lo indica.
 *
 * Reglas de coherencia que respeta:
 * - IDs únicos por ejemplar y por dispositivo.
 * - Un ejemplar pertenece a exactamente un equipo.
 * - Las lecturas están en orden cronológico y nunca antes del alta.
 * - Bajo el agua no hay posición fina: la fuente es acústica y la precisión baja.
 * - La falta de lectura queda registrada como hueco con su causa
 *   (sin posición vs. sin comunicación); no se rellena interpolando.
 */
import type { DemoConfig } from "@/config/demo.config";
import { HABITAT, ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES } from "@/domain/species";
import { DEFAULT_TEAM_BY_SPECIES, TEAMS } from "@/domain/teams";
import type {
  ActivityRecord,
  CareNote,
  CareTask,
  Dataset,
  DeviceProfile,
  GapKind,
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
import { DAY, HOUR, MIN } from "@/logic/time";

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
  "Participó en la sesión de alimentación de la mañana.",
  "Revisión visual de rutina registrada.",
  "Pesaje programado completado.",
  "Se verificó la sujeción del dispositivo.",
  "Observado en interacción habitual con el grupo.",
  "Cambio de banda de identificación registrado.",
  "Participó en la sesión de alimentación de la tarde.",
  "Entrenamiento de acercamiento a báscula completado.",
];

/** Nombres ficticios. Se reparten sin repetir dentro de cada especie. */
const PENGUIN_NAMES = [
  "Aurora", "Atlas", "Nami", "Luna", "Kai", "Sol", "Mako", "Tara", "Nilo", "Brisa", "Coral", "Dante", "Elio", "Frida", "Gala", "Hielo",
  "Iris", "Jade", "Koda", "Lumi", "Milo", "Nube", "Oslo", "Perla", "Quila", "Rocco", "Sami", "Tobi", "Umi", "Vega", "Wilo", "Yuki",
  "Zafiro", "Alba", "Bruno", "Cielo", "Duna", "Eco", "Faro", "Gris", "Halo", "Indi", "Juno", "Kiwi", "Lago", "Mar", "Nieve", "Olas",
  "Pipo", "Runa", "Sora", "Tundra", "Valo", "Ártico", "Bora", "Cora", "Delta", "Fiordo", "Glaciar", "Pingo",
];

/**
 * Nombre de cada ejemplar. Usa su propio generador para no alterar las
 * lecturas ya generadas con la misma semilla; ~1 de cada 8 queda sin nombre.
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
  const reviewFlags: Dataset["reviewFlags"] = [];
  const vetPenguins: string[] = [];

  for (const sp of SPECIES) {
    const count = Math.max(0, Math.floor(config.speciesCounts[sp.id] ?? 0));
    const beh = BEHAVIOR[sp.id];
    const names = namesFor(config.seed, sp.id, count);
    for (let i = 1; i <= count; i++) {
      const rng = mulberry32(hashSeed(config.seed, sp.id, i));
      const id = `${sp.code}-${String(i).padStart(3, "0")}`;
      const deviceId = `TAG-${sp.code[0]}${String(hashSeed(id) % 9000 + 1000)}`;

      // Alta ficticia: la mayoría hace años, unos pocos recién dados de alta.
      const recent = chance(rng, 0.04);
      const registeredAt = recent
        ? Math.floor((now - between(rng, 2, 9) * DAY) / slot) * slot
        : Math.floor((now - between(rng, 400, 2600) * DAY) / DAY) * DAY;

      const isVet = chance(rng, config.vetShare);
      const teamId = isVet ? "vet" : DEFAULT_TEAM_BY_SPECIES[sp.id];
      if (isVet) vetPenguins.push(id);

      const r = rng();
      const profile: DeviceProfile =
        r < config.deviceMix.offline ? "offline" : r < config.deviceMix.offline + config.deviceMix.intermittent ? "intermittent" : "stable";
      const offlineAt = Math.floor((now - between(rng, 7, 40) * HOUR) / slot) * slot;
      const staleTail = profile === "intermittent" ? Math.round(between(rng, 1.8, 5) * HOUR / slot) : 0;

      const lastReviewAt = isVet
        ? now - between(rng, 0.2, 3) * DAY
        : now - Math.pow(rng(), 2.2) * 12.5 * DAY;

      penguins.push({
        id,
        name: names[i - 1],
        speciesId: sp.id,
        registeredAt,
        recordStatus: recent ? "recent" : profile === "offline" ? "incomplete" : "active",
        deviceId,
        bandColor: pick(rng, BAND_COLORS),
        lastReviewAt,
        initialTeamId: teamId,
      });

      devices.push({
        id: deviceId,
        penguinId: id,
        profile,
        lastHeartbeat:
          profile === "offline" ? offlineAt : now - between(rng, profile === "stable" ? 0.5 : 2, profile === "stable" ? 8 : 25) * MIN,
        batteryPct: Math.round(
          profile === "offline" ? between(rng, 4, 15) : profile === "intermittent" ? between(rng, 18, 60) : between(rng, 45, 98),
        ),
      });

      // --- Trayectoria simulada ---
      const list: LocationReading[] = [];
      const gapList: ReadingGap[] = [];
      let medium: "water" | "land" = "land";
      let zoneId = pick(rng, beh.land);
      let restZone = zoneId;
      let pos = randomPointIn(rng, zoneId);
      let restPos = pos;
      let reported: Pt = pos;
      const firstSlot = Math.max(0, Math.ceil((registeredAt - windowStart) / slot));
      let openGap: ReadingGap | null = null;

      const closeGap = () => {
        if (openGap) gapList.push(openGap);
        openGap = null;
      };
      const markGap = (t: number, kind: GapKind) => {
        if (openGap && openGap.kind === kind && openGap.end === t) openGap.end = t + slot;
        else {
          closeGap();
          openGap = { penguinId: id, start: t, end: t + slot, kind };
        }
      };

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

        // El punto de descanso nocturno cambia de vez en cuando.
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

        // --- ¿Hay lectura en este intervalo? ---
        let missing: GapKind | null = null;
        if (profile === "offline" && t > offlineAt) missing = "no_comm";
        else if (profile === "intermittent") {
          if (s >= slots - staleTail) missing = "no_fix";
          else if (chance(rng, 0.16)) missing = medium === "water" || chance(rng, 0.5) ? "no_fix" : "no_comm";
        } else {
          if (zoneId === "deep-dive" && chance(rng, 0.1)) missing = "no_fix";
          else if (chance(rng, 0.015)) missing = "no_fix";
        }
        if (missing) {
          markGap(t, missing);
          continue;
        }
        closeGap();

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
      closeGap();
      readings.set(id, list);
      gaps.set(id, gapList);
      activity.set(id, buildActivity(list, slot));

      // --- Registros ficticios de cuidado ---
      const nNotes = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < nNotes; k++) {
        const at = now - between(rng, 0.3, config.historyDays) * DAY;
        if (at < registeredAt) continue;
        notes.push({ id: `NOTE-${id}-${k}`, penguinId: id, at, by: pick(rng, TEAMS.find((t) => t.id === teamId)!.members), text: pick(rng, NOTE_TEXTS), simulated: true });
      }
      incidents.push({ id: `INC-${id}-reg`, penguinId: id, at: registeredAt, kind: "registry", text: "Alta en el registro de la demo." });
      incidents.push({ id: `INC-${id}-rev`, penguinId: id, at: lastReviewAt, kind: "care", text: "Revisión de rutina completada." });
      if (profile === "offline") incidents.push({ id: `INC-${id}-off`, penguinId: id, at: offlineAt, kind: "device", text: `El dispositivo ${deviceId} dejó de comunicar.` });
      if (profile === "intermittent") incidents.push({ id: `INC-${id}-int`, penguinId: id, at: now - between(rng, 2, 6) * DAY, kind: "device", text: `Comunicación intermitente de ${deviceId}.` });
      if (!recent && chance(rng, 0.12)) incidents.push({ id: `INC-${id}-rep`, penguinId: id, at: now - between(rng, 20, 200) * DAY, kind: "device", text: "Dispositivo reemplazado por mantenimiento." });
      if (chance(rng, 0.035)) reviewFlags.push({ penguinId: id, at: now - between(rng, 1, 40) * HOUR, by: pick(rng, TEAMS.find((t) => t.id === teamId)!.members) });
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
    tasks: generateTasks(config, now, penguins, devices, reviewFlags),
    reviewFlags,
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

function generateTasks(
  config: DemoConfig,
  now: number,
  penguins: Penguin[],
  devices: TrackingDevice[],
  flags: Dataset["reviewFlags"],
): CareTask[] {
  const rng = mulberry32(hashSeed(config.seed, "tasks"));
  const tasks: CareTask[] = [];
  const teamOf = (p: Penguin) => TEAMS.find((t) => t.id === p.initialTeamId)!;
  let n = 1;
  const nextId = () => `TSK-${String(n++).padStart(4, "0")}`;
  const interval = config.rules.careReviewIntervalDays * DAY;

  for (const p of penguins) {
    const due = p.lastReviewAt + interval;
    if (due <= now + DAY) {
      const team = teamOf(p);
      const overdue = due < now;
      const status = overdue && chance(rng, 0.3) ? "in_progress" : "pending";
      tasks.push({
        id: nextId(),
        kind: "routine_review",
        title: "Revisión de rutina",
        penguinId: p.id,
        teamId: team.id,
        createdAt: due - 2 * DAY,
        dueAt: due,
        status,
        history: [
          { at: due - 2 * DAY, by: "Programación automática", text: `Programada cada ${config.rules.careReviewIntervalDays} días.` },
          ...(status === "in_progress" ? [{ at: Math.min(now - HOUR, due + HOUR), by: team.lead, text: "Tomada por el equipo." }] : []),
        ],
      });
    }
  }

  for (const d of devices) {
    if (d.profile === "stable") continue;
    const p = penguins.find((x) => x.id === d.penguinId)!;
    const team = teamOf(p);
    const createdAt = d.profile === "offline" ? d.lastHeartbeat + 6 * HOUR : now - between(rng, 6, 30) * HOUR;
    tasks.push({
      id: nextId(),
      kind: "device_check",
      title: `Verificar dispositivo ${d.id}`,
      penguinId: p.id,
      teamId: team.id,
      createdAt,
      dueAt: d.profile === "offline" ? createdAt + 8 * HOUR : now + between(rng, 3, 30) * HOUR,
      status: "pending",
      history: [{ at: createdAt, by: "Regla de conectividad", text: d.profile === "offline" ? "Creada al detectar dispositivo sin comunicación." : "Creada por comunicación intermitente." }],
    });
  }

  for (const f of flags) {
    const p = penguins.find((x) => x.id === f.penguinId)!;
    tasks.push({
      id: nextId(),
      kind: "observation_followup",
      title: "Seguimiento de observación",
      penguinId: p.id,
      teamId: p.initialTeamId,
      createdAt: f.at,
      dueAt: f.at + DAY,
      status: chance(rng, 0.4) ? "in_progress" : "pending",
      notes: "Registro ficticio: el equipo pidió una revisión de rutina adicional.",
      history: [{ at: f.at, by: f.by, text: "Ejemplar marcado para revisión por el equipo." }],
    });
  }

  for (let k = 0; k < 12; k++) {
    const p = pick(rng, penguins);
    const createdAt = now - between(rng, 1, 4) * DAY;
    tasks.push({
      id: nextId(),
      kind: "weighing",
      title: "Pesaje programado",
      penguinId: p.id,
      teamId: p.initialTeamId,
      zoneId: "care-bay",
      createdAt,
      dueAt: now + between(rng, -0.8, 3) * DAY,
      status: "pending",
      history: [{ at: createdAt, by: teamOf(p).lead, text: "Programado por el equipo." }],
    });
  }

  for (const team of TEAMS) {
    for (const zoneId of team.zoneIds.slice(0, 2)) {
      const createdAt = now - between(rng, 0.5, 3) * DAY;
      tasks.push({
        id: nextId(),
        kind: "zone_maintenance",
        title: `Mantenimiento de ${ZONE_BY_ID[zoneId].name}`,
        teamId: team.id,
        zoneId,
        createdAt,
        dueAt: now + between(rng, -1.2, 2) * DAY,
        status: chance(rng, 0.3) ? "in_progress" : "pending",
        history: [{ at: createdAt, by: team.lead, text: "Programado por el equipo." }],
      });
    }
  }

  // Tareas ya cerradas, para que haya historial de actividad.
  for (let k = 0; k < 30; k++) {
    const p = pick(rng, penguins);
    const team = teamOf(p);
    const createdAt = now - between(rng, 1, 10) * DAY;
    const doneAt = createdAt + between(rng, 2, 30) * HOUR;
    if (doneAt > now) continue;
    const kind = pick(rng, ["routine_review", "weighing", "observation_followup"] as const);
    tasks.push({
      id: nextId(),
      kind,
      title: kind === "routine_review" ? "Revisión de rutina" : kind === "weighing" ? "Pesaje programado" : "Seguimiento de observación",
      penguinId: p.id,
      teamId: team.id,
      createdAt,
      dueAt: createdAt + DAY,
      status: "done",
      history: [
        { at: createdAt, by: team.lead, text: "Programado por el equipo." },
        { at: doneAt, by: pick(rng, team.members), text: "Completada." },
      ],
    });
  }

  return tasks;
}
