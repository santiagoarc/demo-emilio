import { Suspense } from "react";
import { AviaryRulesView } from "@/features/rules/AviaryRulesView";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function AviaryRulesPage() {
  return (
    <Suspense>
      <AviaryRulesView />
    </Suspense>
  );
}
