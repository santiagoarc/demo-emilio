import type { DemoConfig } from "@/config/demo.config";
import type { Dataset } from "@/domain/types";
import { generateDataset } from "./simulate";

/**
 * Punto único por donde la interfaz obtiene datos.
 *
 * Hoy solo existe la fuente simulada. Una fuente real (servicio propio que
 * reciba lecturas normalizadas, ver `src/integration/`) implementaría la misma
 * interfaz y la interfaz no tendría que cambiar.
 */
export interface PenguinDataSource {
  readonly kind: "simulated" | "live";
  readonly label: string;
  load(now: number): Dataset;
}

export function createSimulatedSource(config: DemoConfig): PenguinDataSource {
  return {
    kind: "simulated",
    label: "Demo · Datos simulados",
    load: (now) => generateDataset(config, now),
  };
}
