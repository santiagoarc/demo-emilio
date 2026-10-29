import { Suspense } from "react";
import { SpeciesDetailView } from "@/features/species/SpeciesDetailView";

// La demo genera sus datos en el navegador; no hay UI que validar en el servidor.
export const instant = false;

export default function SpeciesDetailPage() {
  return (
    <Suspense>
      <SpeciesDetailView />
    </Suspense>
  );
}
