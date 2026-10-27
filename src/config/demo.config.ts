import type { SpeciesId } from "@/domain/types";

/**
 * Escenario de demostración.
 *
 * Todo lo que aparece en la demo sale de aquí. Ninguna cifra refleja el
 * inventario real de SeaWorld: los ~206 ejemplares y su reparto por especie son
 * un supuesto de presentación, sujeto a confirmación.
 */
export interface DemoConfig {
  seed: number;
  /** Días de historia simulada. */
  historyDays: number;
  /** Cada cuánto llega una lectura simulada. */
  slotMinutes: number;
  speciesCounts: Record<SpeciesId, number>;
  /** Proporción de ejemplares asignados al equipo veterinario. */
  vetShare: number;
  rules: RulesConfig;
}

/** Umbrales del estado de cada ejemplar y del intervalo de revisión de rutina. */
export interface RulesConfig {
  /** Una ubicación es "reciente" si la última lectura tiene menos de esto. */
  recentLocationMinutes: number;
  /** Sin latido del dispositivo por más de esto → sin comunicación. */
  deviceOfflineMinutes: number;
  /** Días máximos entre revisiones de rutina. */
  careReviewIntervalDays: number;
}

export const DEFAULT_CONFIG: DemoConfig = {
  seed: 20261015,
  historyDays: 14,
  slotMinutes: 30,
  speciesCounts: {
    king: 34,
    gentoo: 48,
    rockhopper: 30,
    chinstrap: 32,
    macaroni: 26,
    adelie: 36,
  },
  vetShare: 0.05,
  rules: {
    recentLocationMinutes: 60,
    deviceOfflineMinutes: 360,
    careReviewIntervalDays: 10,
  },
};
