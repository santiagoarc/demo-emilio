import { Suspense } from "react";
import { AviarySpeciesDetail } from "@/features/aviary/AviarySpeciesDetail";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function AviarySpeciesDetailPage() {
  return (
    <Suspense>
      <AviarySpeciesDetail />
    </Suspense>
  );
}
