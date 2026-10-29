"use client";

import { SPECIES_ICON } from "@/data/aviarySpeciesIcons";
import { cx } from "@/components/ui/primitives";

/**
 * Round species image: the way birds are recognised across the aviary screens.
 * `ring` is a secondary status colour, never the species identifier.
 */
export function SpeciesAvatar({ code, size = 32, ring, className, title }: { code: string; size?: number; ring?: string; className?: string; title?: string }) {
  const icon = SPECIES_ICON[code];
  const scale = 1 / icon.zoom;
  return (
    <span
      title={title}
      className={cx("relative inline-block shrink-0 overflow-hidden rounded-full bg-ink/10", className)}
      style={{ width: size, height: size, boxShadow: ring ? `0 0 0 2px ${ring}` : "0 0 0 1.5px rgba(255,255,255,0.75)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon.src}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: `${icon.fx * 100}% ${icon.fy * 100}%`, transform: `scale(${scale})`, transformOrigin: `${icon.fx * 100}% ${icon.fy * 100}%` }}
      />
    </span>
  );
}
