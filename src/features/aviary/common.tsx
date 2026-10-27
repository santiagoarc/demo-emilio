"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { AVIARY_SPECIES_BY_ID, type AviarySpeciesId, type PresenceStatus } from "@/domain/aviary";
import { Badge, cx } from "@/components/ui/primitives";

/** The one status line every aviary screen carries. */
export function DataStatusBanner({ children }: { children?: ReactNode }) {
  return (
    <div role="note" className="flex items-start gap-3 rounded-2xl border border-dashed border-warn/45 bg-warn/[0.06] px-4 py-3">
      <Info size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-ink">Demo data — simulated roster and sightings. Real inventory not provided yet.</p>
        {children && <p className="mt-0.5 text-xs text-muted">{children}</p>}
      </div>
    </div>
  );
}

/** Small marker for any simulated number. */
export function DemoTag({ className, children = "Demo" }: { className?: string; children?: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-md border border-dashed border-line-strong px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-faint", className)}>
      {children}
    </span>
  );
}

export const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  "publicly-mentioned": "Publicly mentioned",
  confirmed: "Confirmed for this aviary",
  "not-provided": "Not provided",
};

export function PresenceBadge({ status }: { status: PresenceStatus }) {
  return <Badge tone={status === "confirmed" ? "ok" : status === "publicly-mentioned" ? "info" : "neutral"}>{PRESENCE_LABEL[status]}</Badge>;
}

export function SpeciesDot({ id, size = 8 }: { id: AviarySpeciesId; size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: AVIARY_SPECIES_BY_ID[id].color }} />;
}

/** Page frame: header area padding + banner, consistent across screens. */
export function AviaryFrame({ children, banner }: { children: ReactNode; banner?: ReactNode }) {
  return (
    <div className="space-y-5 px-6 lg:px-8">
      <DataStatusBanner>{banner}</DataStatusBanner>
      {children}
    </div>
  );
}
