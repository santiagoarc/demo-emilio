import { Suspense } from "react";
import { BirdProfile } from "@/features/aviary/BirdProfile";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function AviaryBirdPage() {
  return (
    <Suspense>
      <BirdProfile />
    </Suspense>
  );
}
