import { Suspense } from "react";
import { TeamDetailView } from "@/features/teams/TeamDetailView";

// La demo genera sus datos en el navegador; no hay UI que validar en el servidor.
export const instant = false;

export default function TeamDetailPage() {
  return (
    <Suspense>
      <TeamDetailView />
    </Suspense>
  );
}
