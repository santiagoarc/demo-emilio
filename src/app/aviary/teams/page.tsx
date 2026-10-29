import { Suspense } from "react";
import { AviaryTeamsView } from "@/features/aviary/AviaryTeamsView";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function AviaryTeamsPage() {
  return (
    <Suspense>
      <AviaryTeamsView />
    </Suspense>
  );
}
