"use client";

import { useMemo } from "react";
import type { TrackingDataset, TrackingSource } from "@/domain/aviaryTracking";
import { generateTracking, trackingSource } from "@/data/aviaryTrackingSimulate";
import { useDemo } from "./DemoProvider";

let cache: { now: number; ds: TrackingDataset; src: TrackingSource } | null = null;

/** One tracking scenario per demo "now", shared by every screen that asks for it. */
function trackingAt(now: number) {
  if (!cache || cache.now !== now) {
    const ds = generateTracking(now);
    cache = { now, ds, src: trackingSource(ds) };
  }
  return cache;
}

/** Simulated tracking scenario for the 3D monitor. */
export function useTracking() {
  const { now } = useDemo();
  return useMemo(() => {
    const { ds, src } = trackingAt(now);
    return { ds, src, treeById: new Map(ds.trees.map((t) => [t.id, t])), birdById: new Map(ds.birds.map((b) => [b.id, b])) };
  }, [now]);
}
