"use client";

import { CalendarRange, FilterX } from "lucide-react";
import { PENGUIN_ZONES, ZONE_BY_ID } from "@/domain/habitat";
import { SPECIES } from "@/domain/species";
import type { SpeciesId } from "@/domain/types";
import { RANGE_LABEL, activeFilterCount, type RangePreset } from "@/logic/filters";
import { toDateInput } from "@/logic/time";
import { useDemo } from "@/state/DemoProvider";
import { Button, Chip, Segmented, Select, cx } from "@/components/ui/primitives";

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function GlobalFilters({ showRange = true, showPenguin = false, className, compact }: {
  showRange?: boolean;
  showPenguin?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const { filters, setFilters, clearFilters, dataset, range, teamOf } = useDemo();
  const n = activeFilterCount(filters);

  // In the narrow map panel: label on the left, buttons in even columns.
  if (compact) {
    const row = "grid grid-cols-[64px_1fr] items-start gap-2";
    const label = "eyebrow pt-2";
    const chip = "w-full min-w-0 justify-start";
    return (
      <div className={cx("flex flex-col gap-3", className)}>
        <div className={row}>
          <span className={label}>Species</span>
          <div className="grid grid-cols-2 gap-1.5">
            {SPECIES.map((s) => (
              <Chip key={s.id} color={s.color} className={chip} active={filters.species.includes(s.id)} onClick={() => setFilters({ species: toggle(filters.species, s.id as SpeciesId) })}>
                <span className="truncate">{s.nameEn.replace(" Penguin", "")}</span>
              </Chip>
            ))}
          </div>
        </div>
        <div className={row}>
          <span className={label}>Team</span>
          <div className="grid grid-cols-2 gap-1.5">
            {dataset.teams.map((t) => (
              <Chip key={t.id} color={t.color} className={chip} active={filters.teams.includes(t.id)} onClick={() => setFilters({ teams: toggle(filters.teams, t.id) })}>
                <span className="truncate">{t.name}</span>
              </Chip>
            ))}
          </div>
        </div>
        <div className={row}>
          <span className={label}>Zone</span>
          <div className="flex flex-col gap-1.5">
            <Select
              value=""
              onChange={(e) => e.target.value && setFilters({ zones: toggle(filters.zones, e.target.value) })}
              className="h-8 w-full rounded-lg px-2.5 text-xs"
              aria-label="Filter by zone"
            >
              <option value="">+ Zone</option>
              {PENGUIN_ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {filters.zones.includes(z.id) ? "✓ " : ""}
                  {z.name}
                </option>
              ))}
            </Select>
            {filters.zones.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {filters.zones.map((z) => (
                  <Chip key={z} active onRemove={() => setFilters({ zones: filters.zones.filter((x) => x !== z) })}>
                    {ZONE_BY_ID[z]?.name}
                  </Chip>
                ))}
              </div>
            )}
            {n > 0 && (
              <Button size="sm" variant="ghost" className="self-start" onClick={clearFilters}>
                <FilterX size={13} /> Clear ({n})
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="eyebrow mr-1">Species</span>
        {SPECIES.map((s) => (
          <Chip key={s.id} color={s.color} active={filters.species.includes(s.id)} onClick={() => setFilters({ species: toggle(filters.species, s.id as SpeciesId) })}>
            {compact ? s.nameEn.replace(" Penguin", "") : s.nameEn}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="eyebrow mr-1">Team</span>
        {dataset.teams.map((t) => (
          <Chip key={t.id} color={t.color} active={filters.teams.includes(t.id)} onClick={() => setFilters({ teams: toggle(filters.teams, t.id) })}>
            {t.name}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-line-strong" />
        <Select
          value=""
          onChange={(e) => e.target.value && setFilters({ zones: toggle(filters.zones, e.target.value) })}
          className="h-7 rounded-full px-2.5 text-xs"
          aria-label="Filter by zone"
        >
          <option value="">+ Zone</option>
          {PENGUIN_ZONES.map((z) => (
            <option key={z.id} value={z.id}>
              {filters.zones.includes(z.id) ? "✓ " : ""}
              {z.name}
            </option>
          ))}
        </Select>
        {filters.zones.map((z) => (
          <Chip key={z} active onRemove={() => setFilters({ zones: filters.zones.filter((x) => x !== z) })}>
            {ZONE_BY_ID[z]?.name}
          </Chip>
        ))}
        {showPenguin && (
          <Select
            value={filters.penguinId ?? ""}
            onChange={(e) => setFilters({ penguinId: e.target.value || null })}
            className="h-7 rounded-full px-2.5 text-xs"
            aria-label="Filter by penguin"
          >
            <option value="">All penguins</option>
            {dataset.penguins
              .filter((p) => (!filters.species.length || filters.species.includes(p.speciesId)) && (!filters.teams.length || filters.teams.includes(teamOf(p.id))))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}
                </option>
              ))}
          </Select>
        )}
        {n > 0 && (
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            <FilterX size={13} /> Clear ({n})
          </Button>
        )}
      </div>
      {showRange && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Period</span>
          <Segmented<RangePreset>
            size="sm"
            value={filters.range}
            onChange={(v) =>
              setFilters(
                v === "custom" && !filters.customFrom
                  ? { range: v, customFrom: toDateInput(dataset.now - 6 * 86400000), customTo: toDateInput(dataset.now) }
                  : { range: v },
              )
            }
            options={(Object.keys(RANGE_LABEL) as RangePreset[]).map((k) => ({ value: k, label: RANGE_LABEL[k] }))}
          />
          {filters.range === "custom" && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <CalendarRange size={14} />
              <input
                type="date"
                value={filters.customFrom ?? ""}
                min={toDateInput(dataset.windowStart)}
                max={toDateInput(dataset.now)}
                onChange={(e) => setFilters({ customFrom: e.target.value })}
                className="h-7 rounded-lg border border-line-strong bg-panel-solid px-2 text-xs text-ink outline-none"
              />
              <span>to</span>
              <input
                type="date"
                value={filters.customTo ?? ""}
                min={toDateInput(dataset.windowStart)}
                max={toDateInput(dataset.now)}
                onChange={(e) => setFilters({ customTo: e.target.value })}
                className="h-7 rounded-lg border border-line-strong bg-panel-solid px-2 text-xs text-ink outline-none"
              />
            </div>
          )}
          <span className="text-[11px] text-faint">{range.label} · history available: readings every {dataset.slotMinutes} min, {Math.round((dataset.now - dataset.windowStart) / 86400000)} days</span>
        </div>
      )}
    </div>
  );
}
