import { Suspense } from "react";
import { AviaryOverview } from "@/features/aviary/AviaryOverview";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function AviaryPage() {
  return (
    <Suspense>
      <AviaryOverview />
    </Suspense>
  );
}
