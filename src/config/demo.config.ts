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
  /** Proporción de dispositivos con cada perfil de conectividad. */
  deviceMix: { intermittent: number; offline: number };
  /** Proporción de ejemplares asignados al equipo veterinario. */
  vetShare: number;
  rules: AlertRulesConfig;
}

export interface AlertRulesConfig {
  /** Una ubicación es "reciente" si la última lectura tiene menos de esto. */
  recentLocationMinutes: number;
  /** Sin lectura por más de esto (con dispositivo comunicando) → alerta. */
  staleLocationMinutes: number;
  /** Sin latido del dispositivo por más de esto → alerta. */
  deviceOfflineMinutes: number;
  /** Días máximos entre revisiones de rutina. */
  careReviewIntervalDays: number;
  /** Días de atraso de revisión a partir de los cuales sube a prioridad alta. */
  careReviewHighAfterDays: number;
  /** Horas de atraso de una tarea a partir de las cuales sube a prioridad alta. */
  taskOverdueHighAfterHours: number;
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
  deviceMix: { intermittent: 0.05, offline: 0.025 },
  vetShare: 0.05,
  rules: {
    recentLocationMinutes: 60,
    staleLocationMinutes: 90,
    deviceOfflineMinutes: 360,
    careReviewIntervalDays: 10,
    careReviewHighAfterDays: 3,
    taskOverdueHighAfterHours: 24,
  },
};
