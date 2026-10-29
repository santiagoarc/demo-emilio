import type { HealthCaseEntry } from "./types";

/**
 * Care records of the aviary birds: keeper observations and follow-ups.
 * Same shape as the penguin follow-ups, with the reasons that make sense for birds.
 * A follow-up flags something worth a look; it is never a diagnosis.
 */

export type BirdFollowKind = "activity" | "flight" | "still" | "space" | "signal" | "vet" | "incident";

export const FOLLOW_KIND_LABEL: Record<BirdFollowKind, string> = {
  activity: "Unusual change in activity",
  flight: "Less flight than its usual pattern",
  still: "Long time without detected movement",
  space: "Change in use of trees or zones",
  signal: "No recent detections",
  vet: "Veterinary check pending",
  incident: "Incident logged by keepers",
};

export type FollowPriority = "high" | "medium" | "low";

export const PRIORITY_LABEL: Record<FollowPriority, string> = { high: "High", medium: "Medium", low: "Low" };

export interface BirdFollowUp {
  id: string;
  birdId: string;
  kind: BirdFollowKind;
  title: string;
  owner: string;
  priority: FollowPriority;
  openedAt: number;
  /** Next planned review, when one is set. */
  nextReviewAt?: number;
  status: "open" | "closed";
  closedAt?: number;
  /** Newest first. */
  entries: HealthCaseEntry[];
  /** True for the records the scenario starts with; false for the ones added here. */
  simulated: boolean;
}

export interface BirdNote {
  id: string;
  birdId: string;
  at: number;
  by: string;
  text: string;
  simulated: boolean;
}
