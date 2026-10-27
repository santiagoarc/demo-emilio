import type { Habitat, HabitatZone } from "./types";

/**
 * Simulated enclosure layout. Not SeaWorld's actual floor plan: a reference
 * layout to demonstrate the concept.
 * Units: viewBox 1600×1000, 40 units = 1 m (≈ 40 × 25 m).
 */
const ZONES: HabitatZone[] = [
  {
    id: "snow-beach",
    name: "Snow Beach",
    kind: "land",
    medium: "land",
    description: "Snow beach, the main resting area.",
    polygon: [[90, 90], [330, 70], [540, 88], [590, 170], [560, 250], [430, 290], [250, 295], [120, 260], [80, 180]],
  },
  {
    id: "ice-ridge",
    name: "Ice Ridge",
    kind: "land",
    medium: "land",
    description: "Ice ridge with uneven levels.",
    polygon: [[640, 70], [880, 58], [1060, 78], [1090, 150], [1040, 205], [900, 225], [780, 200], [650, 170], [610, 120]],
  },
  {
    id: "nesting-rocks",
    name: "Nesting Rocks",
    kind: "land",
    medium: "land",
    description: "Rock formations and nesting area.",
    polygon: [[1130, 70], [1350, 60], [1520, 95], [1530, 230], [1480, 310], [1340, 320], [1200, 280], [1120, 190]],
  },
  {
    id: "feeding-north",
    name: "Feeding Station North",
    kind: "feeding",
    medium: "land",
    description: "North feeding station.",
    polygon: [[615, 215], [735, 210], [760, 265], [720, 305], [620, 300], [598, 258]],
  },
  {
    id: "main-pool",
    name: "Main Pool",
    kind: "water",
    medium: "water",
    description: "Main pool, medium depth.",
    polygon: [[200, 370], [380, 330], [600, 340], [800, 320], [1000, 350], [1080, 440], [1060, 560], [960, 640], [760, 680], [520, 690], [320, 650], [200, 560], [160, 460]],
  },
  {
    id: "deep-dive",
    name: "Deep Dive Pool",
    kind: "water",
    medium: "water",
    description: "Deep diving pool.",
    polygon: [[1170, 380], [1330, 350], [1480, 390], [1530, 500], [1490, 610], [1360, 650], [1220, 620], [1150, 520]],
  },
  {
    id: "wading-shore",
    name: "Wading Shore",
    kind: "water",
    medium: "water",
    description: "Shallow-water shore.",
    polygon: [[70, 640], [200, 620], [320, 700], [360, 800], [300, 900], [150, 920], [70, 860]],
  },
  {
    id: "pebble-beach",
    name: "Pebble Beach",
    kind: "land",
    medium: "land",
    description: "Pebble beach along the shore.",
    polygon: [[420, 740], [600, 725], [780, 735], [830, 800], [790, 900], [600, 925], [430, 905], [390, 820]],
  },
  {
    id: "feeding-south",
    name: "Feeding Platform South",
    kind: "feeding",
    medium: "land",
    description: "South feeding platform.",
    polygon: [[880, 730], [1030, 715], [1070, 790], [1030, 860], [900, 865], [860, 800]],
  },
  {
    id: "care-bay",
    name: "Care Bay",
    kind: "care",
    medium: "land",
    description: "Check-up and weighing area.",
    polygon: [[1120, 700], [1300, 690], [1330, 770], [1300, 840], [1140, 845], [1100, 770]],
  },
  {
    id: "observation-ledge",
    name: "Observation Ledge",
    kind: "land",
    medium: "land",
    description: "Observation ledge next to the guest gallery.",
    polygon: [[1370, 700], [1520, 680], [1540, 800], [1500, 860], [1380, 860], [1350, 780]],
  },
  {
    id: "vet-holding",
    name: "Vet Holding",
    kind: "care",
    medium: "land",
    restricted: true,
    description: "Veterinary holding. Restricted access.",
    polygon: [[1130, 880], [1330, 875], [1340, 935], [1130, 940]],
  },
  {
    id: "keeper-corridor",
    name: "Keeper Corridor",
    kind: "restricted",
    medium: "land",
    restricted: true,
    description: "Keeper corridor. No penguin access.",
    polygon: [[1380, 890], [1540, 890], [1540, 945], [1380, 945]],
  },
];

export const HABITAT: Habitat = {
  id: "penguin-habitat-demo",
  name: "Penguin Habitat · demo layout",
  width: 1600,
  height: 1000,
  unitsPerMeter: 40,
  zones: ZONES,
  landmarks: [
    { id: "lm-waterfall", name: "Waterfall", x: 560, y: 352, icon: "waterfall" },
    { id: "lm-snow", name: "Snow machine", x: 330, y: 112, icon: "ice" },
    { id: "lm-window", name: "Underwater window", x: 1522, y: 500, icon: "window" },
    { id: "lm-gate-a", name: "Keeper access A", x: 1460, y: 918, icon: "gate" },
    { id: "lm-gate-b", name: "Gate B", x: 74, y: 520, icon: "gate" },
    { id: "lm-scale", name: "Weighing station", x: 1215, y: 768, icon: "station" },
  ],
};

export const ZONE_BY_ID = Object.fromEntries(HABITAT.zones.map((z) => [z.id, z])) as Record<string, HabitatZone>;

/** Zones a penguin can be in (excludes keeper corridors). */
export const PENGUIN_ZONES = HABITAT.zones.filter((z) => z.kind !== "restricted");

export const ZONE_KIND_LABEL: Record<HabitatZone["kind"], string> = {
  water: "Water",
  land: "Land & resting",
  feeding: "Feeding",
  care: "Care",
  restricted: "Restricted",
};
