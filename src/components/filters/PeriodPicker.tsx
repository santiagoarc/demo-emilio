"use client";

import type { RangePreset } from "@/logic/filters";
import { toDateInput } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { cx } from "@/components/ui/primitives";

const OPTIONS: { value: RangePreset | "30d"; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24 h" },
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days" },
  { value: "30d", label: "30 days" },
];

/** Look up a specific day (a custom one-day period). */
export function DayPicker() {
  const { filters, setFilters, dataset, now } = useDemo();
  const single = filters.range === "custom" && filters.customFrom && filters.customFrom === filters.customTo ? filters.customFrom : "";
  return (
    <label className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line bg-ink/[0.05] px-2.5 text-xs text-muted" title="Look up a specific day">
      Date
      <input
        type="date"
        value={single}
        min={toDateInput(dataset.windowStart)}
        max={toDateInput(now)}
        onChange={(e) => (e.target.value ? setFilters({ range: "custom", customFrom: e.target.value, customTo: e.target.value }) : setFilters({ range: "24h" }))}
        className="bg-transparent text-xs text-ink outline-none [color-scheme:dark]"
      />
    </label>
  );
}

/**
 * Query period shared across the whole platform (the global filter).
 * Periods longer than the available history are shown disabled.
 */
export function PeriodPicker() {
  const { filters, setFilters, config } = useDemo();
  const value = filters.range;
  return (
    <div className="inline-flex rounded-xl border border-line bg-ink/[0.05] p-0.5">
      {OPTIONS.map((o) => {
        const days = o.value === "30d" ? 30 : o.value === "14d" ? 14 : o.value === "7d" ? 7 : 1;
        const unavailable = days > config.historyDays;
        return (
          <button
            key={o.value}
            disabled={unavailable}
            title={unavailable ? `This scenario keeps ${config.historyDays} days of readings` : undefined}
            onClick={() => o.value !== "30d" && setFilters({ range: o.value })}
            className={cx(
              "h-7 rounded-[10px] px-2.5 text-xs font-medium transition",
              value === o.value ? "bg-panel-2 text-ink shadow-[0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-ink",
              unavailable && "cursor-not-allowed text-faint/60 hover:text-faint/60",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
