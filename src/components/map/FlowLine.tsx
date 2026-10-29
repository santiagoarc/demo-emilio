"use client";

import { useEffect, useState } from "react";

/** True when the user asked the system for less motion. */
function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduce;
}

/**
 * A recorded path drawn as short dashes that keep flowing from the first
 * point to the last, so the direction of travel reads at a glance. Points
 * must be in chronological order. The dash pattern moves by animating
 * stroke-dashoffset (one full dash + gap per cycle).
 */
export function FlowPolyline({ points, color, width, dash, gap, duration = 1, halo = true }: {
  points: { x: number; y: number }[];
  color: string;
  /** Stroke width and dash / gap lengths, in the drawing's own units. */
  width: number;
  dash: number;
  gap: number;
  /** Seconds per dash cycle. */
  duration?: number;
  /** Light line underneath so the path stands out over busy backgrounds. */
  halo?: boolean;
}) {
  const reduce = useReducedMotion();
  if (points.length < 2) return null;
  const d = points.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <g pointerEvents="none" strokeLinecap="round" strokeLinejoin="round" fill="none">
      {halo && <polyline points={d} stroke="rgba(255,255,255,0.75)" strokeWidth={width * 2.2} />}
      <polyline points={d} stroke={color} strokeWidth={width} strokeDasharray={`${dash} ${gap}`}>
        {!reduce && <animate attributeName="stroke-dashoffset" from="0" to={-(dash + gap)} dur={`${duration}s`} repeatCount="indefinite" />}
      </polyline>
    </g>
  );
}
