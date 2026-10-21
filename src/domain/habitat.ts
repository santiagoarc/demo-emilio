import type { Habitat, HabitatZone } from "./types";

/**
 * Plano simulado del recinto. No es el plano real de SeaWorld: es una
 * distribución de referencia para demostrar el concepto.
 * Unidades: viewBox 1600×1000, 40 unidades = 1 m (≈ 40 × 25 m).
 */
const ZONES: HabitatZone[] = [
  {
    id: "snow-beach",
    name: "Snow Beach",
    kind: "land",
    medium: "land",
    description: "Playa de nieve, zona principal de descanso.",
    polygon: [[90, 90], [330, 70], [540, 88], [590, 170], [560, 250], [430, 290], [250, 295], [120, 260], [80, 180]],
  },
  {
    id: "ice-ridge",
    name: "Ice Ridge",
    kind: "land",
    medium: "land",
    description: "Cresta de hielo con desniveles.",
    polygon: [[640, 70], [880, 58], [1060, 78], [1090, 150], [1040, 205], [900, 225], [780, 200], [650, 170], [610, 120]],
  },
  {
    id: "nesting-rocks",
    name: "Nesting Rocks",
    kind: "land",
    medium: "land",
    description: "Formaciones rocosas y zona de anidación.",
    polygon: [[1130, 70], [1350, 60], [1520, 95], [1530, 230], [1480, 310], [1340, 320], [1200, 280], [1120, 190]],
  },
  {
    id: "feeding-north",
    name: "Feeding Station North",
    kind: "feeding",
    medium: "land",
    description: "Estación de alimentación norte.",
    polygon: [[615, 215], [735, 210], [760, 265], [720, 305], [620, 300], [598, 258]],
  },
  {
    id: "main-pool",
    name: "Main Pool",
    kind: "water",
    medium: "water",
    description: "Piscina principal, profundidad media.",
    polygon: [[200, 370], [380, 330], [600, 340], [800, 320], [1000, 350], [1080, 440], [1060, 560], [960, 640], [760, 680], [520, 690], [320, 650], [200, 560], [160, 460]],
  },
  {
    id: "deep-dive",
    name: "Deep Dive Pool",
    kind: "water",
    medium: "water",
    description: "Piscina profunda de buceo.",
    polygon: [[1170, 380], [1330, 350], [1480, 390], [1530, 500], [1490, 610], [1360, 650], [1220, 620], [1150, 520]],
  },
  {
    id: "wading-shore",
    name: "Wading Shore",
    kind: "water",
    medium: "water",
    description: "Orilla de agua somera.",
    polygon: [[70, 640], [200, 620], [320, 700], [360, 800], [300, 900], [150, 920], [70, 860]],
  },
  {
    id: "pebble-beach",
    name: "Pebble Beach",
    kind: "land",
    medium: "land",
    description: "Playa de grava junto a la orilla.",
    polygon: [[420, 740], [600, 725], [780, 735], [830, 800], [790, 900], [600, 925], [430, 905], [390, 820]],
  },
  {
    id: "feeding-south",
    name: "Feeding Platform South",
    kind: "feeding",
    medium: "land",
    description: "Plataforma de alimentación sur.",
    polygon: [[880, 730], [1030, 715], [1070, 790], [1030, 860], [900, 865], [860, 800]],
  },
  {
    id: "care-bay",
    name: "Care Bay",
    kind: "care",
    medium: "land",
    description: "Área de revisión y pesaje.",
    polygon: [[1120, 700], [1300, 690], [1330, 770], [1300, 840], [1140, 845], [1100, 770]],
  },
  {
    id: "observation-ledge",
    name: "Observation Ledge",
    kind: "land",
    medium: "land",
    description: "Cornisa de observación junto a la galería.",
    polygon: [[1370, 700], [1520, 680], [1540, 800], [1500, 860], [1380, 860], [1350, 780]],
  },
  {
    id: "vet-holding",
    name: "Vet Holding",
    kind: "care",
    medium: "land",
    restricted: true,
    description: "Resguardo veterinario. Acceso restringido.",
    polygon: [[1130, 880], [1330, 875], [1340, 935], [1130, 940]],
  },
  {
    id: "keeper-corridor",
    name: "Keeper Corridor",
    kind: "restricted",
    medium: "land",
    restricted: true,
    description: "Pasillo de cuidadores. Sin acceso para los ejemplares.",
    polygon: [[1380, 890], [1540, 890], [1540, 945], [1380, 945]],
  },
];

export const HABITAT: Habitat = {
  id: "penguin-habitat-demo",
  name: "Penguin Habitat · plano de demostración",
  width: 1600,
  height: 1000,
  unitsPerMeter: 40,
  zones: ZONES,
  landmarks: [
    { id: "lm-waterfall", name: "Cascada", x: 560, y: 352, icon: "waterfall" },
    { id: "lm-snow", name: "Máquina de nieve", x: 330, y: 112, icon: "ice" },
    { id: "lm-window", name: "Ventana subacuática", x: 1522, y: 500, icon: "window" },
    { id: "lm-gate-a", name: "Acceso cuidadores A", x: 1460, y: 918, icon: "gate" },
    { id: "lm-gate-b", name: "Compuerta B", x: 74, y: 520, icon: "gate" },
    { id: "lm-scale", name: "Estación de pesaje", x: 1215, y: 768, icon: "station" },
  ],
};

export const ZONE_BY_ID = Object.fromEntries(HABITAT.zones.map((z) => [z.id, z])) as Record<string, HabitatZone>;

/** Zonas donde puede estar un ejemplar (excluye pasillos de cuidadores). */
export const PENGUIN_ZONES = HABITAT.zones.filter((z) => z.kind !== "restricted");

export const ZONE_KIND_LABEL: Record<HabitatZone["kind"], string> = {
  water: "Agua",
  land: "Tierra y descanso",
  feeding: "Alimentación",
  care: "Cuidado",
  restricted: "Restringida",
};
