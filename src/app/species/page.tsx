import { SpeciesView } from "@/features/species/SpeciesView";

// La demo genera sus datos en el navegador; no hay UI que validar en el servidor.
export const instant = false;

export default function SpeciesPage() {
  return <SpeciesView />;
}
