/**
 * Aviary domain: types, the sourced inventory skeleton and the illustrative
 * layout used by the aviary demo.
 *
 * Nothing here is an inventory of the real aviary. Species groups come from
 * what SeaWorld Abu Dhabi has published (see `source`), counts are unknown
 * until SeaWorld provides them, and the layout is a reference drawing.
 */

export interface SourceRef {
  title: string;
  publisher: string;
  url: string;
  /** Publication date as shown by the source (ISO). */
  published?: string;
  /** Date we consulted it (ISO). */
  accessed: string;
}

/** How much we actually know about a species being in this aviary. */
export type PresenceStatus =
  /** Named by SeaWorld for the park, but not confirmed for this aviary or as a species list. */
  | "publicly-mentioned"
  /** Confirmed by SeaWorld for this aviary. None yet. */
  | "confirmed"
  /** Placeholder for whatever SeaWorld lists that public sources don't. */
  | "not-provided";

export type AviarySpeciesId = "toucan" | "parrot" | "flamingo" | "other";

export interface AviarySpecies {
  id: AviarySpeciesId;
  /** Prefix for demo IDs, e.g. TCN-001. */
  code: string;
  name: string;
  /** Scientific name or taxonomic group; "To be confirmed" when unknown. */
  scientific: string;
  color: string;
  presence: PresenceStatus;
  /** Real head count reported by SeaWorld; null = not provided yet. */
  confirmedCount: number | null;
  /** Where the presence claim comes from; null = no source. */
  source: SourceRef | null;
  note: string;
}

export const SEAWORLD_REALMS_SOURCE: SourceRef = {
  title: "SeaWorld Abu Dhabi reveals Tropical Ocean and other realms",
  publisher: "SeaWorld Abu Dhabi (official site)",
  url: "https://seaworldabudhabi.com/en/news/tropical-ocean-reveal",
  published: "2023-04-10",
  accessed: "2026-10-27",
};

/** Estimate mentioned in the meeting; not a registry. */
export const AVIARY_ESTIMATE = { birds: 500, label: "≈500 birds", status: "Estimate from the meeting · to be confirmed by SeaWorld" };

export const AVIARY_SPECIES: AviarySpecies[] = [
  {
    id: "toucan",
    code: "TCN",
    name: "Toucans",
    scientific: "Ramphastidae · species to be confirmed",
    color: "#F59E0B",
    presence: "publicly-mentioned",
    confirmedCount: null,
    source: SEAWORLD_REALMS_SOURCE,
    note: "The source mentions toucans in The Rainforest aviary without naming species.",
  },
  {
    id: "parrot",
    code: "PRT",
    name: "Parrots & macaws",
    scientific: "Psittaciformes · species to be confirmed",
    color: "#22A06B",
    presence: "publicly-mentioned",
    confirmedCount: null,
    source: SEAWORLD_REALMS_SOURCE,
    note: "The source mentions parrots in The Rainforest aviary without naming species. Macaws appear only in secondary sources.",
  },
  {
    id: "flamingo",
    code: "FLM",
    name: "Caribbean flamingo",
    scientific: "Phoenicopterus ruber",
    color: "#EC6A8C",
    presence: "publicly-mentioned",
    confirmedCount: null,
    source: SEAWORLD_REALMS_SOURCE,
    note: "Published at Flamingo Point (Tropical Ocean). Whether it belongs to the aviary module is to be confirmed.",
  },
  {
    id: "other",
    code: "AVX",
    name: "Other aviary species",
    scientific: "Not provided",
    color: "#7C8DB5",
    presence: "not-provided",
    confirmedCount: null,
    source: null,
    note: "The source says “and more species of birds”. SeaWorld needs to provide the full species list.",
  },
];

export const AVIARY_SPECIES_BY_ID = Object.fromEntries(AVIARY_SPECIES.map((s) => [s.id, s])) as Record<AviarySpeciesId, AviarySpecies>;

/** What SeaWorld would need to send to replace the demo roster with a real inventory. */
export const INVENTORY_REQUEST = [
  "Full species list for the aviary (common and scientific name).",
  "Head count per species, with the date of the count.",
  "Individual identification in use today (leg bands, rings, transponders, none) and its format.",
  "Which areas belong to the aviary module, including whether Flamingo Point is in scope.",
  "Zones or sectors used by keepers, and which team is responsible for each.",
  "How sightings are recorded today (paper, spreadsheet, existing system) and how often.",
];

export type AviaryZoneKind = "canopy" | "floor" | "water" | "feeding" | "nesting" | "holding" | "care";

export interface AviaryZone {
  id: string;
  name: string;
  kind: AviaryZoneKind;
  description: string;
  /** Polygon in plan units (viewBox 1600×1000). Illustrative layout. */
  polygon: [number, number][];
  offExhibit?: boolean;
}

/** Illustrative layout. Not a survey of the real aviary; zones are configurable here. */
export const AVIARY_ZONES: AviaryZone[] = [
  { id: "canopy-walk", name: "Canopy Walk", kind: "canopy", description: "Upper canopy along the guest walkway.", polygon: [[80, 80], [620, 70], [660, 300], [380, 330], [90, 290]] },
  { id: "nesting-trees", name: "Nesting Trees", kind: "nesting", description: "Tall trees and nest boxes.", polygon: [[680, 70], [1060, 80], [1080, 290], [700, 310]] },
  { id: "waterfall-pool", name: "Waterfall Pool", kind: "water", description: "Waterfall, stream and bathing pool.", polygon: [[1100, 80], [1520, 90], [1530, 360], [1120, 330]] },
  { id: "rainforest-floor", name: "Rainforest Floor", kind: "floor", description: "Ground level planting and paths.", polygon: [[90, 340], [640, 350], [680, 640], [100, 660]] },
  { id: "feeding-platform", name: "Feeding Platform", kind: "feeding", description: "Main feeding stations.", polygon: [[700, 350], [1080, 350], [1090, 600], [710, 620]] },
  { id: "flamingo-lagoon", name: "Flamingo Lagoon", kind: "water", description: "Shallow lagoon. Placeholder for Flamingo Point; scope to be confirmed.", polygon: [[1120, 380], [1530, 400], [1520, 700], [1110, 660]] },
  { id: "holding", name: "Off-exhibit Holding", kind: "holding", description: "Back-of-house holding.", polygon: [[100, 700], [700, 680], [710, 920], [110, 930]], offExhibit: true },
  { id: "avian-care", name: "Avian Care Room", kind: "care", description: "Care and quarantine area.", polygon: [[740, 660], [1500, 730], [1500, 930], [740, 930]], offExhibit: true },
];

export const AVIARY_ZONE_BY_ID = Object.fromEntries(AVIARY_ZONES.map((z) => [z.id, z])) as Record<string, AviaryZone>;

export interface AviaryTeam {
  id: string;
  name: string;
  lead: string;
  members: string[];
  zoneIds: string[];
  color: string;
}

/** Fictional teams and people. */
export const AVIARY_TEAMS: AviaryTeam[] = [
  { id: "canopy", name: "Canopy Team", lead: "Lucía Ferrer", members: ["Lucía Ferrer", "Omar Haddad", "Grace Lin"], zoneIds: ["canopy-walk", "nesting-trees"], color: "#0EA5E9" },
  { id: "ground", name: "Ground & Feeding Team", lead: "Tomás Herrera", members: ["Tomás Herrera", "Aisha Rahman", "Ben Carter"], zoneIds: ["rainforest-floor", "feeding-platform", "holding"], color: "#F97316" },
  { id: "wetland", name: "Wetland Team", lead: "Renata Campos", members: ["Renata Campos", "Yusuf Ali", "Mia Novak"], zoneIds: ["waterfall-pool", "flamingo-lagoon"], color: "#8B5CF6" },
  { id: "avian-vet", name: "Avian Veterinary Team", lead: "Dr. Elena Brito", members: ["Dr. Elena Brito", "Dr. Karim Nasser"], zoneIds: ["avian-care"], color: "#14B8A6" },
];

export const AVIARY_TEAM_BY_ID = Object.fromEntries(AVIARY_TEAMS.map((t) => [t.id, t])) as Record<string, AviaryTeam>;

export interface Bird {
  id: string;
  name?: string;
  speciesId: AviarySpeciesId;
  /** Identification method assumed for the demo; real method to be confirmed. */
  bandId: string;
  teamId: string;
  registeredAt: number;
  simulated: true;
}

export type ObservationKind = "sighting" | "feeding" | "headcount" | "note";

/** A keeper's logged sighting. Manual, zone-level: no positions, no sensors. */
export interface BirdObservation {
  id: string;
  birdId: string;
  at: number;
  zoneId: string;
  kind: ObservationKind;
  by: string;
  text?: string;
  simulated: true;
}

export interface AviaryDataset {
  now: number;
  windowStart: number;
  birds: Bird[];
  /** Per bird, oldest first. */
  observations: Map<string, BirdObservation[]>;
}
