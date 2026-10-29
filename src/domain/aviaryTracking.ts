/**
 * Aviary demo: the data model behind the 3D monitor.
 *
 * Everything here is DEMO data for The Rainforest aviary: the 32-species
 * catalogue, the 500 individuals, the layout, trees, devices and detections
 * are fictional and do not describe SeaWorld Abu Dhabi's collection.
 *
 * The types are the contract a real source (trackers, receivers, cameras)
 * would fill through an API. See `TrackingSource`.
 */

/* ---------- Conceptual space ---------- */

/** Plan coordinates in metres on a conceptual footprint: x east, z south, y up (height). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Conceptual footprint. Not the real dimensions of The Rainforest. */
export const FOOTPRINT = { rx: 58, rz: 38, domeHeight: 36, label: "Conceptual layout · not to scale" };

export type LevelId = "ground" | "l1" | "l2" | "l3" | "upper";

export interface HeightLevel {
  id: LevelId;
  label: string;
  short: string;
  /** Metres above ground, [min, max). Provisional ranges, to adjust to the real structure. */
  min: number;
  max: number;
  color: string;
}

export const LEVELS: HeightLevel[] = [
  { id: "upper", label: "Upper canopy (> 18 m)", short: "Upper canopy", min: 18, max: Infinity, color: "#0E7490" },
  { id: "l3", label: "Level 3 (12–18 m)", short: "Level 3", min: 12, max: 18, color: "#0891B2" },
  { id: "l2", label: "Level 2 (6–12 m)", short: "Level 2", min: 6, max: 12, color: "#22B8CF" },
  { id: "l1", label: "Level 1 (0–6 m)", short: "Level 1", min: 0.5, max: 6, color: "#7DD3C0" },
  { id: "ground", label: "Ground (0 m)", short: "Ground", min: -Infinity, max: 0.5, color: "#C9B48A" },
];

export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l])) as Record<LevelId, HeightLevel>;

export function levelOf(heightM: number): HeightLevel {
  return LEVELS.find((l) => heightM >= l.min && heightM < l.max) ?? LEVEL_BY_ID.ground;
}

export interface MonitorZone {
  id: string;
  code: string;
  name: string;
  color: string;
  /** Angular sector of the outer ring, degrees (0 = east, 90 = south). Null = central zone. */
  sector: [number, number] | null;
}

/** Conceptual zoning. Codes and names are working labels, not SeaWorld's. */
export const MONITOR_ZONES: MonitorZone[] = [
  { id: "entrance", code: "Z1", name: "Entrance", color: "#3B82F6", sector: [140, 180] },
  { id: "mangrove", code: "Z2", name: "West Pool", color: "#16A34A", sector: [180, 245] },
  { id: "canopy", code: "Z3", name: "Tree Canopy", color: "#CA8A04", sector: [245, 300] },
  { id: "waterfall", code: "Z4", name: "Waterfalls", color: "#8B5CF6", sector: [-60, 0] },
  { id: "lagoon", code: "Z5", name: "South Lagoon", color: "#0891B2", sector: [95, 140] },
  { id: "nesting", code: "Z6", name: "East Pool", color: "#DC2626", sector: [0, 50] },
  { id: "feeding", code: "Z7", name: "Feeding Area", color: "#EA580C", sector: [50, 95] },
  { id: "greattree", code: "Z8", name: "Great Tree", color: "#0E9F95", sector: null },
];

export const MONITOR_ZONE_BY_ID = Object.fromEntries(MONITOR_ZONES.map((z) => [z.id, z])) as Record<string, MonitorZone>;

/** Inner ellipse (central zone) as a share of the footprint radii. */
export const INNER_RATIO = 0.3;

/** Zone that contains a plan point, or null when it falls outside the footprint. */
export function zoneAt(x: number, z: number): MonitorZone | null {
  const nx = x / FOOTPRINT.rx;
  const nz = z / FOOTPRINT.rz;
  const r = Math.hypot(nx, nz);
  if (r > 1) return null;
  if (r < INNER_RATIO) return MONITOR_ZONE_BY_ID.greattree;
  let deg = (Math.atan2(nz, nx) * 180) / Math.PI;
  if (deg < -60) deg += 360;
  return MONITOR_ZONES.find((zn) => zn.sector && deg >= zn.sector[0] && deg < zn.sector[1]) ?? null;
}

/* ---------- Trees ---------- */

export type TreeForm = "emergent" | "broadleaf" | "palm";

export interface AviaryTree {
  /** Working code (T1, T2…). Final codes would come with a real tree inventory. */
  id: string;
  /** Plant species: an illustrative demo name until a tree inventory exists. */
  plantSpecies: string | null;
  form: TreeForm;
  x: number;
  z: number;
  zoneId: string;
  heightM: number;
  crownRadiusM: number;
  /** Simulated reference points (branch tiers) used by the side view. Not surveyed. */
  branchTiersM: number[];
  simulated: true;
}

/* ---------- Species and individuals ---------- */

export type SpeciesGroup = "toucan" | "parrot" | "turaco" | "pigeon" | "galliform" | "wader" | "other";

export const GROUP_LABEL: Record<SpeciesGroup, string> = {
  toucan: "Toucans",
  parrot: "Parrots & macaws",
  turaco: "Turacos",
  pigeon: "Pigeons",
  galliform: "Pheasants & ground birds",
  wader: "Waders",
  other: "Others",
};

export interface MonitorSpecies {
  id: string;
  /** Prefix for demo IDs, e.g. TUC-001. Design example, not a SeaWorld identifier. */
  code: string;
  common: string;
  /** Spanish common name, as given in the demo brief. */
  commonEs: string;
  scientific: string;
  group: SpeciesGroup;
  color: string;
  /** Usual strata, used only by the simulator. The last one is where it roosts. */
  prefLevels: LevelId[];
  prefZones: string[];
  /** Sex is recorded only for species where it is visible (dimorphic). */
  dimorphic: boolean;
  /** Upper bound for demo ages, years. */
  maxAge: number;
  /** Count requested in the demo brief, before the total is checked. */
  requestedCount: number;
  /** Count actually generated (requested, adjusted so the total is exactly 500). */
  demoCount: number;
}

export type AgeClass = "juvenile" | "subadult" | "adult" | "senior";
export type Sex = "male" | "female";

export type DeviceStatus = "active" | "low-battery" | "intermittent" | "no-signal";

export interface TrackingDevice {
  id: string;
  /** No technology is selected; the demo only names the category. */
  category: "Tracker";
  status: DeviceStatus;
  batteryPct: number;
}

export interface MonitorBird {
  id: string;
  speciesId: string;
  /** Position within its species (1-based); with the code it forms the ID. */
  seq: number;
  name?: string;
  ageYears: number;
  ageClass: AgeClass;
  /** Null when not recorded (monomorphic species, or a juvenile that cannot be told apart). */
  sex: Sex | null;
  homeZoneId: string;
  device: TrackingDevice;
  /** After this moment the device stops reporting (simulated outage). */
  signalLostAt: number | null;
  simulated: true;
}

/* ---------- Detections ---------- */

export type LocationKind =
  /** Identity and position confirmed (e.g. camera frame matched to the tag). */
  | "confirmed"
  /** 3D position calculated from receivers; carries an uncertainty radius. */
  | "computed-3d"
  /** Only the zone is known (weak or intermittent signal). No coordinates are invented. */
  | "zone"
  /** No valid location. */
  | "unknown";

export type DetectionSource = "tracker" | "camera" | "fusion";
export type SignalQuality = "good" | "fair" | "weak" | "none";

export interface Detection {
  birdId: string;
  at: number;
  kind: LocationKind;
  source: DetectionSource;
  zoneId: string | null;
  /** Only for computed-3d and confirmed. */
  pos: Vec3 | null;
  /** Uncertainty radius in metres; null when there is no position. */
  precisionM: number | null;
  /** Tree only when the position falls inside its crown within the uncertainty. Never a branch. */
  treeId: string | null;
  moving: boolean | null;
  signal: SignalQuality;
  /** Location confidence, 0–1. */
  confidence: number;
  simulated: true;
}

/** A period where the bird stayed by one tree: the location history unit. */
export interface Stay {
  /** Stable id: bird id + sequence. Used to prove there are no duplicates. */
  id: string;
  birdId: string;
  start: number;
  end: number;
  zoneId: string;
  /** Tree the bird is in, or under (ground). Always an existing tree. */
  treeId: string;
  /** True when perched in the crown, false when on the ground beneath it. */
  inCrown: boolean;
  pos: Vec3;
}

/** Freshness of the last detection, as shown on the map. */
export type FixStatus = "detected" | "moving" | "stale" | "no-signal";

export const FIX_STATUS: Record<FixStatus, { label: string; color: string; hint: string }> = {
  detected: { label: "Detected", color: "#16A34A", hint: "Detection ≤ 10 min old, stationary" },
  moving: { label: "Moving", color: "#2563EB", hint: "Detection ≤ 10 min old, in transit" },
  stale: { label: "Old location", color: "#D97706", hint: "Last detection 10 min – 6 h ago" },
  "no-signal": { label: "No recent signal", color: "#DC2626", hint: "No detection in 6 h, or never" },
};

export const LOCATION_KIND: Record<LocationKind, { label: string; hint: string }> = {
  confirmed: { label: "Confirmed location", hint: "Identity and position confirmed by a camera match" },
  "computed-3d": { label: "Calculated 3D position", hint: "Estimated from receivers, with an uncertainty radius" },
  zone: { label: "Approximate zone", hint: "Weak signal: only the zone is known; no coordinates" },
  unknown: { label: "Not available", hint: "No valid location" },
};

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  active: "Active",
  "low-battery": "Low battery",
  intermittent: "Intermittent signal",
  "no-signal": "No signal",
};

export const SIGNAL_LABEL: Record<SignalQuality, string> = { good: "Good", fair: "Fair", weak: "Weak", none: "None" };

export const AGE_LABEL: Record<AgeClass, string> = { juvenile: "Juvenile", subadult: "Subadult", adult: "Adult", senior: "Senior" };

/** The persisted demo registry: species, individuals and trees. Detections derive from it. */
export interface DemoRegistry {
  version: number;
  seed: number;
  /** Simulated clock origin (the demo's "now" when it was created). */
  anchor: number;
  createdAt: number;
  species: MonitorSpecies[];
  birds: MonitorBird[];
  trees: AviaryTree[];
  /** Note when the requested distribution had to be corrected to reach 500. */
  distributionNote: string | null;
}

export interface TrackingDataset {
  registry: DemoRegistry;
  /** Start and end of the simulated period. */
  windowStart: number;
  horizon: number;
  /** Per bird, oldest first. */
  stays: Map<string, Stay[]>;
}

/**
 * What any data source has to provide. The demo implements it with a
 * simulator; a real integration would implement it over the tracking API.
 */
export interface TrackingSource {
  latest(birdId: string, asOf: number): Detection | null;
  history(birdId: string, from: number, to: number): Stay[];
}
