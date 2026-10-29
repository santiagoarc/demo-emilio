import { Suspense } from "react";
import { AviaryTreesView } from "@/features/aviary/AviaryTreesView";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function AviaryTreesPage() {
  return (
    <Suspense>
      <AviaryTreesView />
    </Suspense>
  );
}
