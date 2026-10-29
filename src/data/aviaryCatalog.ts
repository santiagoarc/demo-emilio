import type { LevelId, MonitorSpecies, SpeciesGroup } from "@/domain/aviaryTracking";

/**
 * DEMO species catalogue: the 32 species and counts from the demo brief.
 * It does not represent the population of any real facility.
 */

export const DEMO_TOTAL_BIRDS = 500;

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
  B("LOR", "Yellow-naped amazon", "Loro amazónico de nuca amarilla", "Amazona auropalliata", "parrot", "#65A30D", MID, ["canopy", "feeding", "mangrove"], false, 40, 30),
  B("TUC", "Keel-billed toucan", "Tucán pico iris", "Ramphastos sulfuratus", "toucan", "#F59E0B", CANOPY, ["canopy", "nesting", "feeding"], false, 18, 30),
  B("ESP", "Roseate spoonbill", "Espátula rosada", "Platalea ajaja", "wader", "#F472B6", ["ground", "l1", "l2"], ["lagoon", "mangrove"], false, 15, 25),
  B("TCE", "Emerald toucanet", "Tucaneta esmeralda", "Aulacorhynchus prasinus", "toucan", "#22C55E", ["l1", "l2", "l3"], ["canopy", "mangrove"], false, 12, 15),
  B("ARS", "Chestnut-eared aracari", "Arasarí orejicastaño", "Pteroglossus castanotis", "toucan", "#B45309", CANOPY, ["canopy", "nesting"], false, 14, 20),
  B("TPR", "Red-breasted toucan", "Tucán de pecho rojo", "Ramphastos dicolorus", "toucan", "#EF4444", CANOPY, ["canopy", "nesting", "feeding"], false, 16, 15),
  B("GJA", "Hyacinth macaw", "Guacamayo jacinto", "Anodorhynchus hyacinthinus", "parrot", "#1D4ED8", CANOPY, ["canopy", "nesting", "feeding"], false, 50, 12),
  B("GBU", "Great green macaw", "Guacamayo de Buffon", "Ara ambiguus", "parrot", "#15803D", CANOPY, ["canopy", "nesting"], false, 50, 12),
  B("GAV", "Green-winged macaw", "Guacamayo aliverde", "Ara chloropterus", "parrot", "#B91C1C", CANOPY, ["canopy", "nesting", "feeding"], false, 50, 18),
  B("GBA", "Blue-throated macaw", "Guacamayo barbazul", "Ara glaucogularis", "parrot", "#0EA5E9", CANOPY, ["canopy", "feeding"], false, 40, 10),
  B("ECL", "Eclectus parrot", "Loro eclecto", "Eclectus roratus", "parrot", "#16A34A", MID, ["canopy", "nesting"], true, 30, 20),
  B("TVI", "Violet turaco", "Turaco violeta", "Musophaga violacea", "turaco", "#6D28D9", ["l2", "l3"], ["canopy", "nesting"], false, 20, 15),
  B("TCR", "Red-crested turaco", "Turaco crestirrojo", "Tauraco erythrolophus", "turaco", "#DC2626", ["l2", "l3"], ["canopy", "mangrove"], false, 20, 15),
  B("THA", "Hartlaub's turaco", "Turaco de Hartlaub", "Tauraco hartlaubi", "turaco", "#2563EB", ["l2", "l3"], ["canopy", "nesting"], false, 20, 12),
  B("TCB", "White-crested turaco", "Turaco crestiblanco", "Tauraco leucolophus", "turaco", "#84CC16", ["l2", "l3"], ["mangrove", "canopy"], false, 20, 12),
  B("TCA", "White-cheeked turaco", "Turaco cariblanco", "Tauraco leucotis", "turaco", "#10B981", ["l2", "l3"], ["nesting", "canopy"], false, 20, 12),
  B("TLI", "Livingstone's turaco", "Turaco de Livingston", "Tauraco livingstonii", "turaco", "#059669", ["l2", "l3"], ["canopy", "mangrove"], false, 20, 12),
  B("PNI", "Nicobar pigeon", "Paloma de Nicobar", "Caloenas nicobarica", "pigeon", "#0D9488", ["ground", "l1", "l2"], ["feeding", "entrance", "nesting"], false, 20, 20),
  B("PIB", "Pied imperial pigeon", "Paloma imperial bicolor", "Ducula bicolor", "pigeon", "#94A3B8", CANOPY, ["canopy", "waterfall"], false, 18, 20),
  B("PCV", "Victoria crowned pigeon", "Paloma coronada de Victoria", "Goura victoria", "pigeon", "#60A5FA", ["ground", "l1", "l2"], ["feeding", "nesting", "entrance"], false, 20, 12),
  B("ARG", "Great argus", "Argos gigante malayo", "Argusianus argus", "galliform", "#92400E", ["ground", "l1", "l2"], ["nesting", "feeding"], true, 15, 10),
  B("PBC", "Crested partridge", "Perdiz de bosque crestada", "Rollulus rouloul", "galliform", "#166534", ["ground", "l1"], ["mangrove", "feeding"], true, 10, 12),
  B("PAV", "Indian peafowl", "Pavo real común", "Pavo cristatus", "galliform", "#1E40AF", ["ground", "l1", "l2"], ["entrance", "feeding", "nesting"], true, 20, 15),
  B("FLA", "Lady Amherst's pheasant", "Faisán de Lady Amherst", "Chrysolophus amherstiae", "galliform", "#475569", ["ground", "l1", "l2"], ["mangrove", "nesting"], true, 15, 10),
  B("FDO", "Golden pheasant", "Faisán dorado", "Chrysolophus pictus", "galliform", "#EAB308", ["ground", "l1", "l2"], ["feeding", "entrance"], true, 15, 15),
  B("TGO", "Western plantain-eater", "Turaco gris occidental", "Crinifer piscator", "turaco", "#78716C", CANOPY, ["waterfall", "canopy"], false, 18, 12),
  B("KOO", "Laughing kookaburra", "Kookaburra risueño", "Dacelo novaeguineae", "other", "#A16207", ["l1", "l2", "l3"], ["waterfall", "entrance"], false, 20, 15),
  B("BCB", "Bearded barbet", "Barbudo de cabeza blanca", "Pogonornis dubius", "other", "#BE123C", MID, ["canopy", "feeding"], false, 15, 12),
  B("CHA", "White-crested laughingthrush", "Charlatán crestiblanco", "Garrulax leucolophus", "other", "#C2410C", ["ground", "l1", "l2"], ["mangrove", "feeding", "entrance"], false, 12, 20),
  B("CIG", "Painted stork", "Cigüeña pintada", "Mycteria leucocephala", "wader", "#DB2777", ["ground", "l1", "l2"], ["lagoon", "mangrove"], false, 25, 15),
  B("IBE", "Scarlet ibis", "Ibis escarlata", "Eudocimus ruber", "wader", "#F43F5E", ["ground", "l1", "l2"], ["mangrove", "lagoon"], false, 20, 15),
  B("IBB", "Glossy ibis", "Ibis brillante", "Plegadis falcinellus", "wader", "#7C2D12", ["ground", "l1", "l2"], ["lagoon", "mangrove", "waterfall"], false, 18, 15),
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
