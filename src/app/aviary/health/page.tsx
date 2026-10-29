import { Suspense } from "react";
import { AviaryHealthView } from "@/features/aviary/care/AviaryHealthView";

// The registry lives in the browser; there is nothing to render on the server.
export const instant = false;

export default function AviaryHealthPage() {
  return (
    <Suspense>
      <AviaryHealthView />
    </Suspense>
  );
}
