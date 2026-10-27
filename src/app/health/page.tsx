import { Suspense } from "react";
import { HealthView } from "@/features/health/HealthView";

// La demo genera sus datos en el navegador; no hay UI que validar en el servidor.
export const instant = false;

export default function HealthPage() {
  return (
    <Suspense>
      <HealthView />
    </Suspense>
  );
}
