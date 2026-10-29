"use client";

import { useMemo, type ReactNode } from "react";
import { Info } from "lucide-react";
import { loadClock } from "@/data/aviaryDemoStore";
import { snapshot } from "@/logic/aviaryTracking";
import { useTracking } from "@/state/useTracking";

/** The status line every aviary screen carries. */
export function DataStatusBanner({ children }: { children?: ReactNode }) {
  return (
    <div role="note" className="flex items-start gap-3 rounded-2xl border border-dashed border-warn/45 bg-warn/[0.06] px-4 py-3">
      <Info size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-ink">
          <span className="mr-1.5 rounded bg-warn px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">DEMO / SIMULATED DATA</span>
          Fictional species counts, birds, trees and movements generated for this demonstration.
        </p>
        {children && <p className="mt-1 text-xs text-muted">{children}</p>}
      </div>
    </div>
  );
}

/** Page frame: padding + banner, consistent across screens. */
export function AviaryFrame({ children, banner }: { children: ReactNode; banner?: ReactNode }) {
  return (
    <div className="space-y-5 px-6 lg:px-8">
      <DataStatusBanner>{banner}</DataStatusBanner>
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
