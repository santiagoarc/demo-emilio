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
    <Drawer open={open} onClose={onClose} title="Escenario de demostración" width={460}>
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
        Todos los datos de esta demo son ficticios. El número de ejemplares por especie es un supuesto de presentación y no
        representa el inventario real. Cambiarlo regenera el escenario completo.
      </p>

      <div>
        <p className="eyebrow mb-3">Ejemplares por especie</p>
        <div className="space-y-2">
          {SPECIES.map((s) => (
            <label key={s.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
              <PenguinIllustration speciesId={s.id} size={32} />
              <span className="flex-1 text-sm">
                {s.nameEs}
                <span className="block text-[11px] text-faint">{s.nameEn}</span>
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
          Semilla
          <span className="block text-[11px] text-faint">Misma semilla, mismo escenario.</span>
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
          Aplicar y regenerar
        </Button>
      </div>

      <div className="border-t border-line pt-5">
        <p className="eyebrow mb-2">Reiniciar</p>
        <p className="mb-3 text-xs text-muted">Descarta reasignaciones, observaciones y cambios de equipos, y vuelve al escenario inicial.</p>
        {confirm ? (
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => apply(DEFAULT_CONFIG)}>
              <RotateCcw size={14} /> Confirmar reinicio
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancelar</Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setConfirm(true)}>
            <RotateCcw size={14} /> Reiniciar datos de demostración
          </Button>
        )}
      </div>
    </div>
  );
}
