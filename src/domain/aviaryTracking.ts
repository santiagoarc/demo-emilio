/**
 * Aviary tracking concept: the data model behind the 3D monitor.
 *
 * Everything here is a design for The Rainforest aviary, not a survey of it.
 * The layout, trees, species catalogue, devices and detections are DEMO data
 * until SeaWorld provides plans, a tree inventory and its species list.
 *
 * The types are the contract a real source (trackers, receivers, cameras,
 * keeper logs) would have to fill through the API. See `TrackingSource`.
 */

/* ---------- Conceptual space ---------- */

/** Plan coordinates in metres on a conceptual footprint: x east, z south, y up. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Conceptual footprint. Not the real dimensions of The Rainforest. */
export const FOOTPRINT = { rx: 58, rz: 38, domeHeight: 26, label: "Conceptual layout · not to scale" };

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
  { id: "entrance", code: "Z1", name: "Entrance", color: "#3B82F6", sector: [170, 210] },
  { id: "mangrove", code: "Z2", name: "Mangrove", color: "#16A34A", sector: [210, 270] },
  { id: "canopy", code: "Z3", name: "Tree Canopy", color: "#CA8A04", sector: [270, 330] },
  { id: "waterfall", code: "Z4", name: "Waterfall", color: "#8B5CF6", sector: [-30, 30] },
  { id: "lagoon", code: "Z5", name: "Central Lagoon", color: "#0891B2", sector: null },
  { id: "nesting", code: "Z6", name: "Nesting Area", color: "#DC2626", sector: [30, 90] },
  { id: "feeding", code: "Z7", name: "Feeding Area", color: "#EA580C", sector: [90, 170] },
];

export const MONITOR_ZONE_BY_ID = Object.fromEntries(MONITOR_ZONES.map((z) => [z.id, z])) as Record<string, MonitorZone>;

/** Inner ellipse (central zone) as a share of the footprint radii. */
export const INNER_RATIO = 0.4;

/** Zone that contains a plan point, or null when it falls outside the footprint. */
export function zoneAt(x: number, z: number): MonitorZone | null {
  const nx = x / FOOTPRINT.rx;
  const nz = z / FOOTPRINT.rz;
  const r = Math.hypot(nx, nz);
  if (r > 1) return null;
  if (r < INNER_RATIO) return MONITOR_ZONE_BY_ID.lagoon;
  let deg = (Math.atan2(nz, nx) * 180) / Math.PI;
  if (deg < -30) deg += 360;
  return MONITOR_ZONES.find((zn) => zn.sector && deg >= zn.sector[0] && deg < zn.sector[1]) ?? null;
}

/* ---------- Trees and structures ---------- */

export type TreeForm = "emergent" | "broadleaf" | "palm";

export interface AviaryTree {
  /** Working code (T1, T2…). Final codes come with the real tree inventory. */
  id: string;
  /** Plant species; null until the tree inventory exists. */
  plantSpecies: string | null;
  form: TreeForm;
  x: number;
  z: number;
  zoneId: string;
  heightM: number;
  crownRadiusM: number;
  /** Heights of the main branch tiers drawn in the side view. Schematic, not surveyed. */
  branchTiersM: number[];
  simulated: true;
}

export interface AviaryStructure {
  id: string;
  name: string;
  kind: "platform" | "walkway";
  x: number;
  z: number;
  heightM: number;
  zoneId: string;
}

/* ---------- Species and individuals ---------- */

/** Group as published by SeaWorld (see aviary.ts), so honesty labels stay consistent. */
export type SpeciesGroup = "toucan" | "parrot" | "flamingo" | "other";

/** Body-mass class: drives which tracking method is even plausible. */
export type MassClass = "tiny" | "small" | "medium" | "large";

export interface MonitorSpecies {
  id: string;
  /** Prefix for demo IDs, e.g. TUC-001. Design example, not a SeaWorld identifier. */
  code: string;
  common: string;
  scientific: string;
  group: SpeciesGroup;
  mass: MassClass;
  color: string;
  /** Usual strata, used only by the simulator. */
  prefLevels: LevelId[];
  prefZones: string[];
  /** Demo roster size. Not a head count. */
  demoCount: number;
}

/**
 * How the simulated scenario locates a bird. Real methods depend on species
 * size, admissible device weight, battery life, coverage and veterinary approval.
 */
export type TrackingMethod =
  /** Tag + receiver network able to compute a 3D position. */
  | "tag-3d"
  /** Tag detected by receivers, only zone-level. */
  | "tag-zone"
  /** No tag: visual detections only (camera with identity match, or keeper). */
  | "visual"
  /** No method assigned yet. */
  | "none";

export type DeviceStatus = "active" | "low-battery" | "no-signal" | "not-fitted";

export interface TrackingDevice {
  id: string;
  /** Technology is not selected; the demo only names the category. */
  category: "Tracker · technology to be selected" | "None";
  status: DeviceStatus;
  batteryPct: number | null;
}

export interface MonitorBird {
  id: string;
  speciesId: string;
  name?: string;
  method: TrackingMethod;
  device: TrackingDevice;
  /** After this moment the device stops reporting (simulated outage). */
  signalLostAt: number | null;
  simulated: true;
}

/* ---------- Detections ---------- */

export type LocationKind =
  /** Identity and position confirmed (e.g. camera frame matched to the tag, or keeper check). */
  | "confirmed"
  /** 3D position calculated from receivers; carries an uncertainty radius. */
  | "computed-3d"
  /** Only the zone is known. No coordinates are invented. */
  | "zone"
  /** No valid location. */
  | "unknown";

export type DetectionSource = "tracker" | "camera" | "keeper" | "fusion";

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
  /** Null when the method cannot tell. */
  moving: boolean | null;
  simulated: true;
}

/** A period where the bird stayed in one place: the location history unit. */
export interface Stay {
  birdId: string;
  start: number;
  end: number;
  zoneId: string;
  treeId: string | null;
  structureId: string | null;
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
  confirmed: { label: "Confirmed location", hint: "Identity and position confirmed visually" },
  "computed-3d": { label: "Calculated 3D position", hint: "Estimated from receivers, with an uncertainty radius" },
  zone: { label: "Approximate zone", hint: "Only the zone is known; no coordinates" },
  unknown: { label: "Not available", hint: "No valid location" },
};

export const METHOD_LABEL: Record<TrackingMethod, string> = {
  "tag-3d": "Tag + receivers (3D)",
  "tag-zone": "Tag + receivers (zone level)",
  visual: "Visual only (camera / keeper)",
  none: "No method assigned",
};

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  active: "Active",
  "low-battery": "Low battery",
  "no-signal": "No signal",
  "not-fitted": "Not fitted · suitability to evaluate",
};

export interface TrackingDataset {
  now: number;
  windowStart: number;
  species: MonitorSpecies[];
  birds: MonitorBird[];
  trees: AviaryTree[];
  structures: AviaryStructure[];
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
