import { Suspense } from "react";
import { AviaryReportsView } from "@/features/aviary/AviaryReportsView";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function AviaryReportsPage() {
  return (
    <Suspense>
      <AviaryReportsView />
    </Suspense>
  );
}
