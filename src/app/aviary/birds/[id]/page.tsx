import { Suspense } from "react";
import { BirdProfileView } from "@/features/aviary/BirdProfileView";

// The registry lives in the browser; there is nothing to render on the server.
export const instant = false;

export default function AviaryBirdPage() {
  return (
    <Suspense>
      <BirdProfileView />
    </Suspense>
  );
}
