import { Suspense } from "react";
import { AviaryInventory } from "@/features/aviary/AviaryInventory";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function AviaryInventoryPage() {
  return (
    <Suspense>
      <AviaryInventory />
    </Suspense>
  );
}
