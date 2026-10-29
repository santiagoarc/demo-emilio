import { Suspense } from "react";
import { MapView } from "@/features/map/MapView";

// La demo genera sus datos en el navegador; no hay UI que validar en el servidor.
export const instant = false;

export default function MapPage() {
  return (
    <Suspense>
      <MapView />
    </Suspense>
  );
}
