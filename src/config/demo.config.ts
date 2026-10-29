import type { SpeciesId } from "@/domain/types";

/**
 * Demo scenario.
 *
 * Everything shown in the demo comes from here. No figure reflects SeaWorld's
 * actual collection: the ~206 penguins and their species split are a
 * presentation assumption, subject to confirmation.
 */
export interface DemoConfig {
  seed: number;
  /** Days of simulated history. */
  historyDays: number;
  /** How often a simulated reading arrives. */
  slotMinutes: number;
  speciesCounts: Record<SpeciesId, number>;
  /** Share of penguins assigned to the veterinary team. */
  vetShare: number;
  rules: RulesConfig;
}

/** Thresholds for each penguin's status and the routine-check interval. */
export interface RulesConfig {
  /** A location is "recent" if the last reading is younger than this. */
  recentLocationMinutes: number;
  /** No device heartbeat for longer than this → treated as no recent signal. */
  deviceOfflineMinutes: number;
  /** Maximum days between routine checks. */
  careReviewIntervalDays: number;
}

export const DEFAULT_CONFIG: DemoConfig = {
  seed: 20261015,
  historyDays: 14,
  slotMinutes: 30,
  speciesCounts: {
    king: 34,
    gentoo: 48,
    rockhopper: 30,
    chinstrap: 32,
    macaroni: 26,
    adelie: 36,
  },
  vetShare: 0.05,
  rules: {
    recentLocationMinutes: 60,
    deviceOfflineMinutes: 360,
    careReviewIntervalDays: 10,
  },
};
