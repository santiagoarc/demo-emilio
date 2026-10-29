import { Suspense } from "react";
import { TeamsView } from "@/features/teams/TeamsView";

// La demo genera sus datos en el navegador; no hay UI que validar en el servidor.
export const instant = false;

export default function TeamsPage() {
  return (
    <Suspense>
      <TeamsView />
    </Suspense>
  );
}
