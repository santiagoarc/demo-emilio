import { Suspense } from "react";
import { AviaryHabitat } from "@/features/aviary/AviaryHabitat";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function AviaryHabitatPage() {
  return (
    <Suspense>
      <AviaryHabitat />
    </Suspense>
  );
}
