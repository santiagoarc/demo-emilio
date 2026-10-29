import { AviaryMonitor } from "@/features/aviary/monitor/AviaryMonitor";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function AviaryMonitorPage() {
  return <AviaryMonitor />;
}
