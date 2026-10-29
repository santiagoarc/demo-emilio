import type { LevelId, MonitorSpecies, SpeciesGroup } from "@/domain/aviaryTracking";

/**
 * DEMO species catalogue: the 32 species and counts from the demo brief.
 * It does not represent the population of any real facility.
 */

export const DEMO_TOTAL_BIRDS = 500;

/** Each species has one exclusive colour, used on every map, list and card. */

type Brief = Omit<MonitorSpecies, "id" | "demoCount">;

const B = (
  code: string,
  common: string,
  commonEs: string,
  scientific: string,
  group: SpeciesGroup,
  color: string,
  prefLevels: LevelId[],
  prefZones: string[],
  dimorphic: boolean,
  maxAge: number,
  requestedCount: number,
): Brief => ({ code, common, commonEs, scientific, group, color, prefLevels, prefZones, dimorphic, maxAge, requestedCount });

const CANOPY: LevelId[] = ["l2", "l3", "upper"];
const MID: LevelId[] = ["l1", "l2", "l3"];

export const SPECIES_BRIEF: Brief[] = [
  B("LOR", "Yellow-naped amazon", "Loro amazónico de nuca amarilla", "Amazona auropalliata", "parrot", "#FACC15", MID, ["canopy", "feeding", "mangrove"], false, 40, 30),
  B("TUC", "Keel-billed toucan", "Tucán pico iris", "Ramphastos sulfuratus", "toucan", "#F97316", CANOPY, ["canopy", "nesting", "feeding", "greattree"], false, 18, 30),
  B("ESP", "Roseate spoonbill", "Espátula rosada", "Platalea ajaja", "wader", "#F9A8D4", ["ground", "l1", "l2"], ["lagoon", "mangrove"], false, 15, 25),
  B("TCE", "Emerald toucanet", "Tucaneta esmeralda", "Aulacorhynchus prasinus", "toucan", "#10B981", ["l1", "l2", "l3"], ["canopy", "mangrove"], false, 12, 15),
  B("ARS", "Chestnut-eared aracari", "Arasarí orejicastaño", "Pteroglossus castanotis", "toucan", "#92400E", CANOPY, ["canopy", "nesting", "greattree"], false, 14, 20),
  B("TPR", "Red-breasted toucan", "Tucán de pecho rojo", "Ramphastos dicolorus", "toucan", "#E11D48", CANOPY, ["canopy", "nesting", "feeding", "greattree"], false, 16, 15),
  B("GJA", "Hyacinth macaw", "Guacamayo jacinto", "Anodorhynchus hyacinthinus", "parrot", "#1E3A8A", CANOPY, ["canopy", "nesting", "feeding", "greattree"], false, 50, 12),
  B("GBU", "Great green macaw", "Guacamayo de Buffon", "Ara ambiguus", "parrot", "#84CC16", CANOPY, ["canopy", "nesting", "greattree"], false, 50, 12),
  B("GAV", "Green-winged macaw", "Guacamayo aliverde", "Ara chloropterus", "parrot", "#15803D", CANOPY, ["canopy", "nesting", "feeding", "greattree"], false, 50, 18),
  B("GBA", "Blue-throated macaw", "Guacamayo barbazul", "Ara glaucogularis", "parrot", "#38BDF8", CANOPY, ["canopy", "feeding", "greattree"], false, 40, 10),
  B("ECL", "Eclectus parrot", "Loro eclecto", "Eclectus roratus", "parrot", "#A21CAF", MID, ["canopy", "nesting", "greattree"], true, 30, 20),
  B("TVI", "Violet turaco", "Turaco violeta", "Musophaga violacea", "turaco", "#6D28D9", ["l2", "l3"], ["canopy", "nesting", "greattree"], false, 20, 15),
  B("TCR", "Red-crested turaco", "Turaco crestirrojo", "Tauraco erythrolophus", "turaco", "#7F1D1D", ["l2", "l3"], ["canopy", "mangrove", "greattree"], false, 20, 15),
  B("THA", "Hartlaub's turaco", "Turaco de Hartlaub", "Tauraco hartlaubi", "turaco", "#2563EB", ["l2", "l3"], ["canopy", "nesting", "greattree"], false, 20, 12),
  B("TCB", "White-crested turaco", "Turaco crestiblanco", "Tauraco leucolophus", "turaco", "#0891B2", ["l2", "l3"], ["mangrove", "canopy", "greattree"], false, 20, 12),
  B("TCA", "White-cheeked turaco", "Turaco cariblanco", "Tauraco leucotis", "turaco", "#5EEAD4", ["l2", "l3"], ["nesting", "canopy", "greattree"], false, 20, 12),
  B("TLI", "Livingstone's turaco", "Turaco de Livingston", "Tauraco livingstonii", "turaco", "#4ADE80", ["l2", "l3"], ["canopy", "mangrove", "greattree"], false, 20, 12),
  B("PNI", "Nicobar pigeon", "Paloma de Nicobar", "Caloenas nicobarica", "pigeon", "#164E63", ["ground", "l1", "l2"], ["feeding", "entrance", "nesting"], false, 20, 20),
  B("PIB", "Pied imperial pigeon", "Paloma imperial bicolor", "Ducula bicolor", "pigeon", "#64748B", CANOPY, ["canopy", "waterfall"], false, 18, 20),
  B("PCV", "Victoria crowned pigeon", "Paloma coronada de Victoria", "Goura victoria", "pigeon", "#93C5FD", ["ground", "l1", "l2"], ["feeding", "nesting", "entrance"], false, 20, 12),
  B("ARG", "Great argus", "Argos gigante malayo", "Argusianus argus", "galliform", "#D97706", ["ground", "l1", "l2"], ["nesting", "feeding"], true, 15, 10),
  B("PBC", "Crested partridge", "Perdiz de bosque crestada", "Rollulus rouloul", "galliform", "#3F6212", ["ground", "l1"], ["mangrove", "feeding"], true, 10, 12),
  B("PAV", "Indian peafowl", "Pavo real común", "Pavo cristatus", "galliform", "#4338CA", ["ground", "l1", "l2"], ["entrance", "feeding", "nesting"], true, 20, 15),
  B("FLA", "Lady Amherst's pheasant", "Faisán de Lady Amherst", "Chrysolophus amherstiae", "galliform", "#EC4899", ["ground", "l1", "l2"], ["mangrove", "nesting"], true, 15, 10),
  B("FDO", "Golden pheasant", "Faisán dorado", "Chrysolophus pictus", "galliform", "#9D174D", ["ground", "l1", "l2"], ["feeding", "entrance"], true, 15, 15),
  B("TGO", "Western plantain-eater", "Turaco gris occidental", "Crinifer piscator", "turaco", "#A8A29E", CANOPY, ["waterfall", "canopy", "greattree"], false, 18, 12),
  B("KOO", "Laughing kookaburra", "Kookaburra risueño", "Dacelo novaeguineae", "other", "#F0ABFC", ["l1", "l2", "l3"], ["waterfall", "entrance"], false, 20, 15),
  B("BCB", "Bearded barbet", "Barbudo de cabeza blanca", "Pogonornis dubius", "other", "#171717", MID, ["canopy", "feeding"], false, 15, 12),
  B("CHA", "White-crested laughingthrush", "Charlatán crestiblanco", "Garrulax leucolophus", "other", "#A78BFA", ["ground", "l1", "l2"], ["mangrove", "feeding", "entrance"], false, 12, 20),
  B("CIG", "Painted stork", "Cigüeña pintada", "Mycteria leucocephala", "wader", "#FDBA74", ["ground", "l1", "l2"], ["lagoon", "mangrove"], false, 25, 15),
  B("IBE", "Scarlet ibis", "Ibis escarlata", "Eudocimus ruber", "wader", "#EF4444", ["ground", "l1", "l2"], ["mangrove", "lagoon"], false, 20, 15),
  B("IBB", "Glossy ibis", "Ibis brillante", "Plegadis falcinellus", "wader", "#52525B", ["ground", "l1", "l2"], ["lagoon", "mangrove", "waterfall"], false, 18, 15),
];

/**
 * Scale counts so they add up to `total` (largest-remainder method).
 * When the requested counts already add up, they are returned unchanged.
 */
export function adjustToTotal(counts: number[], total: number): number[] {
  const sum = counts.reduce((a, b) => a + b, 0);
  if (sum === total || sum === 0) return [...counts];
  const exact = counts.map((c) => (c * total) / sum);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k].i]++;
  return out;
}

const requested = SPECIES_BRIEF.map((s) => s.requestedCount);
const REQUESTED_SUM = requested.reduce((a, b) => a + b, 0);
const adjusted = adjustToTotal(requested, DEMO_TOTAL_BIRDS);

export const MONITOR_SPECIES: MonitorSpecies[] = SPECIES_BRIEF.map((s, i) => ({ ...s, id: s.code.toLowerCase(), demoCount: adjusted[i] }));

export const MONITOR_SPECIES_BY_ID = Object.fromEntries(MONITOR_SPECIES.map((s) => [s.id, s])) as Record<string, MonitorSpecies>;

export const REQUESTED_TOTAL = REQUESTED_SUM;

/** Human note on the correction, or null when the brief already added up. */
export const DISTRIBUTION_NOTE: string | null =
  REQUESTED_SUM === DEMO_TOTAL_BIRDS
    ? null
    : `The requested counts add up to ${REQUESTED_SUM}, not ${DEMO_TOTAL_BIRDS}. They were scaled to ${DEMO_TOTAL_BIRDS} proportionally (largest remainder): ${MONITOR_SPECIES.filter((s) => s.demoCount !== s.requestedCount)
        .map((s) => `${s.code} ${s.requestedCount}→${s.demoCount}`)
        .join(", ")}.`;
