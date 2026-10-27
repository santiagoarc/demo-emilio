import type { DemoConfig } from "@/config/demo.config";
import type { Dataset } from "@/domain/types";
import { generateDataset } from "./simulate";

/**
 * Single entry point through which the UI gets its data.
 *
 * Today only the simulated source exists. A real source (an in-house service
 * receiving normalized readings, see `src/integration/`) would implement the
 * same interface and the UI would not need to change.
 */
export interface PenguinDataSource {
  readonly kind: "simulated" | "live";
  readonly label: string;
  load(now: number): Dataset;
}

export function createSimulatedSource(config: DemoConfig): PenguinDataSource {
  return {
    kind: "simulated",
    label: "Demo · Simulated data",
    load: (now) => generateDataset(config, now),
  };
}
