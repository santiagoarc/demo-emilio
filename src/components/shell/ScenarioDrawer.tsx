"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { DEFAULT_CONFIG, type DemoConfig } from "@/config/demo.config";
import { SPECIES } from "@/domain/species";
import type { SpeciesId } from "@/domain/types";
import { useDemo } from "@/state/DemoProvider";
import { Button, Drawer } from "@/components/ui/primitives";
import { PenguinIllustration } from "@/components/penguin/PenguinIllustration";

export function ScenarioDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="Demo scenario" width={460}>
      {open && <ScenarioForm onDone={onClose} />}
    </Drawer>
  );
}

function ScenarioForm({ onDone }: { onDone: () => void }) {
  const { config, resetDemo } = useDemo();
  const [counts, setCounts] = useState<Record<SpeciesId, number>>({ ...config.speciesCounts });
  const [seed, setSeed] = useState(config.seed);
  const [confirm, setConfirm] = useState(false);
  const total = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);

  const apply = (cfg: DemoConfig) => {
    resetDemo(cfg);
    onDone();
  };

  return (
    <div className="space-y-6 p-5">
      <p className="text-xs leading-relaxed text-muted">
        All data in this demo is fictional. The number of penguins per species is a presentation assumption and does not
        reflect the actual collection. Changing it regenerates the whole scenario.
      </p>

      <div>
        <p className="eyebrow mb-3">Penguins per species</p>
        <div className="space-y-2">
          {SPECIES.map((s) => (
            <label key={s.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
              <PenguinIllustration speciesId={s.id} size={32} />
              <span className="flex-1 text-sm">
                {s.nameEn}
                <span className="block text-[11px] italic text-faint">{s.scientific}</span>
              </span>
              <input
                type="number"
                min={0}
                max={150}
                value={counts[s.id]}
                onChange={(e) => setCounts((c) => ({ ...c, [s.id]: Math.max(0, Math.min(150, Number(e.target.value) || 0)) }))}
                className="num h-8 w-20 rounded-lg border border-line-strong bg-panel-2 px-2 text-right text-sm outline-none focus:border-accent/60"
              />
            </label>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>Total</span>
          <span className="num font-semibold text-ink">{total}</span>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          Seed
          <span className="block text-[11px] text-faint">Same seed, same scenario.</span>
        </span>
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value) || 1)}
          className="num h-8 w-32 rounded-lg border border-line-strong bg-panel-2 px-2 text-right text-sm outline-none focus:border-accent/60"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => apply({ ...config, seed, speciesCounts: counts })} disabled={total === 0}>
          Apply and regenerate
        </Button>
      </div>

      <div className="border-t border-line pt-5">
        <p className="eyebrow mb-2">Reset</p>
        <p className="mb-3 text-xs text-muted">Discards reassignments, observations and team changes, and returns to the initial scenario.</p>
        {confirm ? (
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => apply(DEFAULT_CONFIG)}>
              <RotateCcw size={14} /> Confirm reset
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setConfirm(true)}>
            <RotateCcw size={14} /> Reset demo data
          </Button>
        )}
      </div>
    </div>
  );
}
