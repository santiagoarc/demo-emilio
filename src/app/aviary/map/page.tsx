import { Suspense } from "react";
import { AviaryMapView } from "@/features/aviary/AviaryMapView";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function AviaryMapPage() {
  return (
    <Suspense>
      <AviaryMapView />
    </Suspense>
  );
}
