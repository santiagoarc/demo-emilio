import { Suspense } from "react";
import { AviaryOverviewView } from "@/features/aviary/AviaryOverviewView";

// The registry lives in the browser; there is nothing to render on the server.
export const instant = false;

export default function AviaryOverviewPage() {
  return (
    <Suspense>
      <AviaryOverviewView />
    </Suspense>
  );
}
