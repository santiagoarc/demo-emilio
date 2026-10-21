import type { Species, SpeciesId } from "./types";

export const SPECIES: Species[] = [
  { id: "king", code: "KNG", nameEs: "Pingüino rey", nameEn: "King Penguin", scientific: "Aptenodytes patagonicus", color: "#F4B740" },
  { id: "gentoo", code: "GEN", nameEs: "Pingüino papúa", nameEn: "Gentoo Penguin", scientific: "Pygoscelis papua", color: "#FF7A59" },
  { id: "rockhopper", code: "RCK", nameEs: "Pingüino saltarrocas", nameEn: "Rockhopper Penguin", scientific: "Eudyptes chrysocome", color: "#E6E35A" },
  { id: "chinstrap", code: "CHN", nameEs: "Pingüino barbijo", nameEn: "Chinstrap Penguin", scientific: "Pygoscelis antarcticus", color: "#A5B8FF" },
  { id: "macaroni", code: "MAC", nameEs: "Pingüino macaroni", nameEn: "Macaroni Penguin", scientific: "Eudyptes chrysolophus", color: "#E57CF5" },
  { id: "adelie", code: "ADL", nameEs: "Pingüino de Adelia", nameEn: "Adélie Penguin", scientific: "Pygoscelis adeliae", color: "#9BE15D" },
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s])) as Record<SpeciesId, Species>;
