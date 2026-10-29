/**
 * Public-source references used by the Overview and Validation pages.
 *
 * The aviary demo itself (32 species, 500 birds) lives in aviaryTracking.ts
 * and aviaryCatalog.ts and is fictional.
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

export const SEAWORLD_REALMS_SOURCE: SourceRef = {
  title: "SeaWorld Abu Dhabi reveals Tropical Ocean and other realms",
  publisher: "SeaWorld Abu Dhabi (official site)",
  url: "https://seaworldabudhabi.com/en/news/tropical-ocean-reveal",
  published: "2023-04-10",
  accessed: "2026-10-27",
};

/** What SeaWorld would need to send to replace the demo registry with a real inventory. */
export const INVENTORY_REQUEST = [
  "Full species list for the aviary (common and scientific name).",
  "Head count per species, with the date of the count.",
  "Individual identification in use today (leg bands, rings, transponders, none) and its format.",
  "Plans or measurements of the aviary and an inventory of its trees and structures.",
  "Zones or sectors used by keepers, and which team is responsible for each.",
  "How sightings are recorded today (paper, spreadsheet, existing system) and how often.",
];
