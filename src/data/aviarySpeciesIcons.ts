/**
 * Species marker images: a local copy (330 px) of each species reference photo
 * from Wikimedia Commons (attribution in aviarySpeciesInfo.ts), with the point
 * to centre on and how tightly to crop, so the round marker shows the bird.
 */

export interface SpeciesIcon {
  src: string;
  /** Centre of the crop, as a share of the image width / height. */
  fx: number;
  fy: number;
  /** Crop side as a share of the image's shorter side (smaller = closer). */
  zoom: number;
}

const I = (code: string, fx: number, fy: number, zoom: number, ext = "jpg"): [string, SpeciesIcon] => [code, { src: `/aviary/species/${code}.${ext}`, fx, fy, zoom }];

export const SPECIES_ICON: Record<string, SpeciesIcon> = Object.fromEntries([
  I("LOR", 0.45, 0.42, 0.7),
  I("TUC", 0.36, 0.4, 0.7),
  I("ESP", 0.6, 0.33, 0.6),
  I("TCE", 0.5, 0.45, 0.7),
  I("ARS", 0.42, 0.36, 0.65),
  I("TPR", 0.45, 0.4, 0.7),
  I("GJA", 0.36, 0.38, 0.6),
  I("GBU", 0.6, 0.35, 0.6),
  I("GAV", 0.47, 0.3, 0.8),
  I("GBA", 0.62, 0.3, 0.8),
  I("ECL", 0.5, 0.33, 0.85),
  I("TVI", 0.6, 0.45, 0.65),
  I("TCR", 0.45, 0.48, 0.8),
  I("THA", 0.45, 0.45, 0.8),
  I("TCB", 0.55, 0.4, 0.85),
  I("TCA", 0.47, 0.33, 0.8),
  I("TLI", 0.45, 0.35, 0.8),
  I("PNI", 0.4, 0.45, 0.65),
  I("PIB", 0.4, 0.42, 0.65),
  I("PCV", 0.5, 0.38, 0.85),
  I("ARG", 0.62, 0.42, 0.85),
  I("PBC", 0.45, 0.42, 0.6),
  I("PAV", 0.58, 0.25, 0.45),
  I("FLA", 0.7, 0.45, 0.65),
  I("FDO", 0.55, 0.45, 0.65),
  I("TGO", 0.6, 0.32, 0.6),
  I("KOO", 0.45, 0.45, 0.55),
  I("BCB", 0.45, 0.4, 0.6),
  I("CHA", 0.45, 0.36, 0.65),
  I("CIG", 0.5, 0.36, 0.7),
  I("IBE", 0.6, 0.3, 0.65),
  I("IBB", 0.6, 0.4, 0.65, "png"),
]);
