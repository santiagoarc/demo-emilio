"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, FlaskConical, Info, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Badge, Button, Card, cx } from "@/components/ui/primitives";

/**
 * Proposed rules: configurable examples to discuss with SeaWorld.
 * They never notify anyone; the preview only counts matches in the demo data.
 */

export interface RuleMatch {
  key: string;
  label: string;
  detail?: string;
  href?: string;
}

export interface RuleDef {
  id: string;
  name: string;
  /** Takes the current threshold so the text always matches the setting. */
  description: (threshold: number) => string;
  scope: string;
  /** What data the rule reads. */
  basis: string;
  threshold: { label: string; unit: string; default: number; min: number; max: number; step: number };
  defaultEnabled: boolean;
  /** Singular / plural noun for what the rule matches (birds, zones, penguins...). */
  noun: [string, string];
  evaluate: (threshold: number) => RuleMatch[];
}

export interface RuleIdea {
  name: string;
  needs: string;
}

type Saved = Record<string, { enabled: boolean; threshold: number }>;

function load(key: string): Saved {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Saved) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function save(key: string, value: Saved) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // No storage (private mode, quota): settings live in memory for this session.
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function ProposedRules({ storageKey, rules, ideas, intro, backHref, backLabel }: {
  storageKey: string;
  rules: RuleDef[];
  ideas: RuleIdea[];
  intro: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  // The demo renders only on the client (DemoProvider waits for the browser), so reading storage here is safe.
  const [saved, setSaved] = useState<Saved>(() => (typeof window === "undefined" ? {} : load(storageKey)));

  const settingOf = (r: RuleDef) => {
    const s = saved[r.id];
    return {
      enabled: typeof s?.enabled === "boolean" ? s.enabled : r.defaultEnabled,
      threshold: typeof s?.threshold === "number" && Number.isFinite(s.threshold) ? clamp(s.threshold, r.threshold.min, r.threshold.max) : r.threshold.default,
    };
  };

  const update = (r: RuleDef, patch: Partial<{ enabled: boolean; threshold: number }>) => {
    setSaved((prev) => {
      const next = { ...prev, [r.id]: { ...settingOf(r), ...prev[r.id], ...patch } };
      save(storageKey, next);
      return next;
    });
  };

  const reset = () => {
    setSaved({});
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore: nothing persisted.
    }
  };

  const enabledCount = rules.filter((r) => settingOf(r).enabled).length;

  return (
    <div className="space-y-5">
      <div role="note" className="flex items-start gap-3 rounded-2xl border border-dashed border-accent-2/45 bg-accent-2/[0.05] px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-accent-2" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-ink">Proposed rules — configurable examples, not operational alerts.</p>
          <p className="mt-0.5 text-xs text-muted">{intro}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="num">{enabledCount} of {rules.length} examples switched on in this preview</span>
        <span className="text-faint">· Settings are saved in this browser only</span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={reset}>
          <RotateCcw size={12} aria-hidden /> Reset examples
        </Button>
        {backHref && (
          <Link href={backHref} className="text-xs text-accent hover:underline">{backLabel ?? "Back"}</Link>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {rules.map((r) => (
          <RuleCard key={r.id} rule={r} setting={settingOf(r)} onChange={(p) => update(r, p)} />
        ))}
      </div>

      <Card title="Rule ideas that need validated data or technology" subtitle="Listed for discussion. No matches are shown because the data does not exist in this demo." icon={FlaskConical}>
        <ul className="grid gap-3 md:grid-cols-3">
          {ideas.map((i) => (
            <li key={i.name} className="rounded-xl border border-dashed border-line-strong p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{i.name}</p>
                <Badge tone="warn">Requires validation</Badge>
              </div>
              <p className="mt-1.5 text-xs text-muted">{i.needs}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function RuleCard({ rule, setting, onChange }: {
  rule: RuleDef;
  setting: { enabled: boolean; threshold: number };
  onChange: (p: Partial<{ enabled: boolean; threshold: number }>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const { threshold: t } = rule;
  const matches = useMemo(() => rule.evaluate(setting.threshold), [rule, setting.threshold]);
  const noun = matches.length === 1 ? rule.noun[0] : rule.noun[1];
  const inputId = `rule-${rule.id}-threshold`;
  const listId = `rule-${rule.id}-matches`;

  const commit = (raw: string) => {
    const v = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(v)) onChange({ threshold: clamp(v, t.min, t.max) });
    setDraft(null);
  };

  return (
    <section className={cx("panel fade-up flex min-w-0 flex-col p-5 transition", !setting.enabled && "opacity-80")} aria-labelledby={`rule-${rule.id}-name`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`rule-${rule.id}-name`} className="text-[15px] font-semibold tracking-tight">{rule.name}</h3>
            <Badge tone="neutral" className="border border-dashed border-line-strong">Proposed · not active</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">{rule.description(setting.threshold)}</p>
        </div>
        <button
          role="switch"
          aria-checked={setting.enabled}
          aria-label={`${setting.enabled ? "Switch off" : "Switch on"} example rule: ${rule.name}`}
          onClick={() => onChange({ enabled: !setting.enabled })}
          className={cx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", setting.enabled ? "bg-accent" : "bg-ink/15")}
        >
          <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", setting.enabled ? "left-[22px]" : "left-0.5")} />
        </button>
      </header>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-faint">Scope</dt>
          <dd className="mt-0.5 text-ink">{rule.scope}</dd>
        </div>
        <div>
          <dt className="text-faint">Reads</dt>
          <dd className="mt-0.5 text-ink">{rule.basis}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink/[0.02] px-3 py-2.5">
        <SlidersHorizontal size={14} className="text-muted" aria-hidden />
        <label htmlFor={inputId} className="text-xs text-muted">{t.label}</label>
        <div className="flex items-center gap-1.5">
          <input
            id={inputId}
            type="number"
            inputMode="decimal"
            min={t.min}
            max={t.max}
            step={t.step}
            value={draft ?? String(setting.threshold)}
            onChange={(e) => {
              setDraft(e.target.value);
              const v = Number(e.target.value);
              if (e.target.value.trim() !== "" && Number.isFinite(v) && v >= t.min && v <= t.max) onChange({ threshold: v });
            }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)}
            className="num h-8 w-20 rounded-lg border border-line-strong bg-panel-solid px-2 text-sm text-ink outline-none focus:border-accent/60"
          />
          <span className="text-xs text-muted">{t.unit}</span>
        </div>
        <span className="num ml-auto text-[11px] text-faint">Range {t.min}–{t.max}</span>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={listId}
          disabled={matches.length === 0}
          className="flex w-full items-center justify-between gap-2 text-left text-sm disabled:cursor-default"
        >
          <span>
            Would match <b className="num">{matches.length}</b> {noun} in the demo data
            {!setting.enabled && <span className="ml-1 text-xs text-faint">(example switched off)</span>}
          </span>
          {matches.length > 0 && <ChevronDown size={14} className={cx("text-muted transition", open && "rotate-180")} aria-hidden />}
        </button>
        {open && matches.length > 0 && (
          <ul id={listId} className="mt-2 space-y-1">
            {matches.slice(0, 8).map((m) => (
              <li key={m.key} className="flex items-baseline justify-between gap-3 text-xs">
                {m.href ? (
                  <Link href={m.href} className="truncate font-medium text-accent hover:underline">{m.label}</Link>
                ) : (
                  <span className="truncate font-medium">{m.label}</span>
                )}
                {m.detail && <span className="num shrink-0 text-muted">{m.detail}</span>}
              </li>
            ))}
            {matches.length > 8 && <li className="text-[11px] text-faint">+{matches.length - 8} more</li>}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-faint">Preview only. Computed on simulated data; nothing is sent to anyone.</p>
      </div>
    </section>
  );
}
