"use client";

import { useMemo, type ReactNode } from "react";
import { loadClock } from "@/data/aviaryDemoStore";
import { snapshot } from "@/logic/aviaryTracking";
import { useTracking } from "@/state/useTracking";

/** Page frame: padding, consistent across screens. */
export function AviaryFrame({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5 px-6 lg:px-8">
      {children}
    </div>
  );
}

/** Demo data plus the latest detections at the saved simulated clock time. */
export function useAviarySnapshot() {
  const t = useTracking();
  const asOf = useMemo(() => loadClock(t.registry).simTime, [t.registry]);
  const fixes = useMemo(() => snapshot(t.ds, t.src, asOf), [t.ds, t.src, asOf]);
  return { ...t, asOf, fixes };
}
