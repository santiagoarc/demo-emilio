import { Suspense } from "react";
import { AlertsView } from "@/features/alerts/AlertsView";

// La demo genera sus datos en el navegador; no hay UI que validar en el servidor.
export const instant = false;

export default function AlertsPage() {
  return (
    <Suspense>
      <AlertsView />
    </Suspense>
  );
}
