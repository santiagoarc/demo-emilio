import { Suspense } from "react";
import { BirdRegistry } from "@/features/aviary/BirdRegistry";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function AviaryBirdsPage() {
  return (
    <Suspense>
      <BirdRegistry />
    </Suspense>
  );
}
