"use client";

import { useMemo } from "react";
import { AVIARY_SPECIES_BY_ID, type AviaryDataset, type Bird } from "@/domain/aviary";
import { generateAviary } from "@/data/aviarySimulate";
import { useDemo } from "./DemoProvider";

let cache: { now: number; ds: AviaryDataset } | null = null;

/** One aviary dataset per demo "now", shared by every screen that asks for it. */
function aviaryAt(now: number): AviaryDataset {
  if (!cache || cache.now !== now) cache = { now, ds: generateAviary(now) };
  return cache.ds;
}

/** Simulated aviary data for the current demo "now". */
export function useAviary() {
  const { now } = useDemo();
  return useMemo(() => {
    const ds = aviaryAt(now);
    const birdById = new Map<string, Bird>(ds.birds.map((b) => [b.id, b]));
    const speciesName = (b: Bird) => AVIARY_SPECIES_BY_ID[b.speciesId].name;
    return { ds, birdById, speciesName };
  }, [now]);
}
