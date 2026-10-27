import { Suspense } from "react";
import { PenguinRulesView } from "@/features/rules/PenguinRulesView";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function PenguinRulesPage() {
  return (
    <Suspense>
      <PenguinRulesView />
    </Suspense>
  );
}
