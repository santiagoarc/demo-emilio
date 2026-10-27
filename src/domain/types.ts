/**
 * Modelo de dominio de la demo.
 *
 * Estos tipos son el contrato entre la capa de datos (hoy simulada, mañana
 * servicios reales) y la interfaz. Nada en los componentes debe depender de
 * cómo se generan los datos, solo de esta forma.
 */

export type SpeciesId =
  | "king"
  | "gentoo"
  | "rockhopper"
  | "chinstrap"
  | "macaroni"
  | "adelie";

export interface Species {
  id: SpeciesId;
  code: string; // prefijo de ID, p. ej. KNG
  nameEs: string;
  nameEn: string;
  scientific: string;
  color: string; // color del marcador en el mapa
}

export type ZoneKind = "water" | "land" | "feeding" | "care" | "restricted";
export type Medium = "water" | "land";

export interface HabitatZone {
  id: string;
  name: string;
  kind: ZoneKind;
  /** Medio físico de la zona (las de alimentación y cuidado son en tierra). */
  medium: Medium;
  /** Polígono en unidades del plano (viewBox 1600×1000). */
  polygon: [number, number][];
  restricted?: boolean;
  description: string;
}

export interface Landmark {
  id: string;
  name: string;
  x: number;
  y: number;
  icon: "gate" | "window" | "waterfall" | "ice" | "station" | "camera-off";
}

export interface Habitat {
  id: string;
  name: string;
  width: number;
  height: number;
  unitsPerMeter: number;
  zones: HabitatZone[];
  landmarks: Landmark[];
}

export type DeviceProfile = "stable" | "intermittent" | "offline";

export interface TrackingDevice {
  id: string;
  penguinId: string;
  profile: DeviceProfile;
  /** Último latido del dispositivo (ms). Para "offline" es cuando dejó de comunicar. */
  lastHeartbeat: number;
  batteryPct: number;
}

export type RecordStatus = "active" | "recent" | "incomplete";

export interface Penguin {
  id: string;
  /** Nombre registrado por el equipo; no todos los ejemplares lo tienen. */
  name?: string;
  speciesId: SpeciesId;
  registeredAt: number; // fecha de alta ficticia
  recordStatus: RecordStatus;
  deviceId: string;
  bandColor: string;
  lastReviewAt: number;
  /** Equipo asignado al generar el escenario (el vigente vive en el estado). */
  initialTeamId: string;
}

export interface CareTeam {
  id: string;
  name: string;
  lead: string;
  members: string[];
  zoneIds: string[];
  color: string;
  focus: string;
  /** Ausente = activo. Desactivar no borra registros ni reasigna pingüinos. */
  active?: boolean;
  /** Rol de cada integrante; quien no aparece no tiene rol registrado. */
  roles?: Record<string, string>;
}

/** Turno configurado de un integrante. La demo no trae turnos: solo existen si alguien los registra. */
export interface Shift {
  id: string;
  teamId: string;
  member: string;
  /** Día de la semana, 0 = domingo. */
  weekday: number;
  start: string; // "06:00"
  end: string; // "14:00"
  availability: "available" | "partial" | "unavailable";
}

export type ReadingSource = "uwb" | "acoustic" | "rfid_gate";
export type ReadingQuality = "high" | "medium" | "low";

export interface LocationReading {
  penguinId: string;
  deviceId: string;
  timestamp: number;
  zoneId: string;
  x: number;
  y: number;
  /** Radio de incertidumbre en metros. */
  accuracyM: number;
  source: ReadingSource;
  quality: ReadingQuality;
  /** Agua o tierra según el sensor de inmersión (no según la zona). */
  medium: Medium;
  simulated: true;
}

/** Huecos en las lecturas y su causa conocida. */
export type GapKind = "no_fix" | "no_comm";

export interface ReadingGap {
  penguinId: string;
  start: number;
  end: number;
  kind: GapKind;
}

/** Tramo continuo en un mismo medio y zona, derivado de las lecturas. */
export interface ActivityRecord {
  penguinId: string;
  start: number;
  end: number;
  medium: Medium;
  zoneId: string;
  readings: number;
  /** Todas las lecturas del tramo comparten posición exacta. */
  stationary: boolean;
}

/** Motivo de un seguimiento especial de salud. */
export type HealthReason = "injury" | "weight" | "molt" | "treatment" | "behavior" | "other";

export interface HealthCaseEntry {
  id: string;
  at: number;
  by: string;
  text: string;
  /** Peso registrado en esa revisión, si se pesó. */
  weightKg?: number;
}

/** Caso de seguimiento: un pingüino que el equipo vigila por algo de salud en particular. */
export interface HealthCase {
  id: string;
  penguinId: string;
  reason: HealthReason;
  title: string;
  owner: string;
  openedAt: number;
  status: "open" | "closed";
  closedAt?: number;
  /** De la más reciente a la más antigua. */
  entries: HealthCaseEntry[];
  simulated: boolean;
}

export interface CareNote {
  id: string;
  penguinId: string;
  at: number;
  by: string;
  text: string;
  /** `true` en las del escenario; `false` en las que registra el usuario en la demo. */
  simulated: boolean;
}

export interface Incident {
  id: string;
  penguinId: string;
  at: number;
  text: string;
  kind: "device" | "care" | "assignment" | "registry";
}

/** Todo lo que la interfaz necesita. Es lo que entrega una DataSource. */
export interface Dataset {
  generatedAt: number;
  now: number;
  windowStart: number;
  slotMinutes: number;
  habitat: Habitat;
  species: Species[];
  teams: CareTeam[];
  penguins: Penguin[];
  devices: TrackingDevice[];
  readings: Map<string, LocationReading[]>; // por pingüino, en orden cronológico
  gaps: Map<string, ReadingGap[]>;
  activity: Map<string, ActivityRecord[]>;
  notes: CareNote[];
  incidents: Incident[];
}
