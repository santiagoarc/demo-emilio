import { Suspense } from "react";
import { AviaryTeamDetailView } from "@/features/aviary/AviaryTeamsView";

// The registry lives in the browser; there is nothing to render on the server.
export const instant = false;

export default function AviaryTeamPage() {
  return (
    <Suspense>
      <AviaryTeamDetailView />
    </Suspense>
  );
}
