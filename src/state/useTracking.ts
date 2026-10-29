"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AviaryTree, DemoRegistry, MonitorBird, TrackingDataset, TrackingSource } from "@/domain/aviaryTracking";
import { buildTimeline, trackingSource } from "@/data/aviaryTrackingSimulate";
import { clearDemoStorage, loadClock, loadRegistry, saveClock, type ClockState, type RegistryOrigin } from "@/data/aviaryDemoStore";

export interface TrackingState {
  registry: DemoRegistry;
  origin: RegistryOrigin;
  ds: TrackingDataset;
  src: TrackingSource;
  treeById: Map<string, AviaryTree>;
  birdById: Map<string, MonitorBird>;
}

let state: TrackingState | null = null;
const listeners = new Set<() => void>();

/** Loads (or creates once) the persisted registry and derives its timeline. */
function current(): TrackingState {
  if (!state) {
    const { registry, origin } = loadRegistry();
    const ds = buildTimeline(registry);
    state = {
      registry,
      origin,
      ds,
      src: trackingSource(ds),
      treeById: new Map(registry.trees.map((t) => [t.id, t])),
      birdById: new Map(registry.birds.map((b) => [b.id, b])),
    };
  }
  return state;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Aviary demo data shared by every aviary screen. */
export function useTracking(): TrackingState {
  return useSyncExternalStore(subscribe, current, current);
}

/** Throw away the stored demo and generate a new one (same catalogue, new seed run). */
export function resetDemoData() {
  clearDemoStorage();
  state = null;
  listeners.forEach((fn) => fn());
}

const TICK_MS = 500;

/**
 * Simulated clock. While playing it advances `speed` simulated seconds per
 * real second, up to the end of the simulated period; it is saved so a
 * reload continues where it was.
 */
export function useSimClock(registry: DemoRegistry, horizon: number) {
  const [clock, setClock] = useState<ClockState>(() => loadClock(registry));
  const ref = useRef(clock);
  useEffect(() => {
    ref.current = clock;
  });

  useEffect(() => {
    if (!clock.playing) return;
    const id = window.setInterval(() => {
      setClock((c) => {
        const simTime = Math.min(horizon, c.simTime + c.speed * TICK_MS);
        return { ...c, simTime, playing: simTime < horizon && c.playing };
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [clock.playing, horizon]);

  // Save every few seconds and when leaving the page.
  useEffect(() => {
    const save = () => saveClock(registry, ref.current);
    const id = window.setInterval(save, 3000);
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.clearInterval(id);
      window.removeEventListener("pagehide", save);
    };
  }, [registry]);

  const set = useCallback((patch: Partial<ClockState>) => setClock((c) => ({ ...c, ...patch })), []);
  const restart = useCallback(() => setClock((c) => ({ ...c, simTime: registry.anchor, playing: true })), [registry.anchor]);
  return { clock, set, restart };
}
