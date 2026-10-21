import { Suspense } from "react";
import { PenguinProfileView } from "@/features/penguins/PenguinProfileView";

// La demo genera sus datos en el navegador; no hay UI que validar en el servidor.
export const instant = false;

export default function PenguinPage() {
  return (
    <Suspense>
      <PenguinProfileView />
    </Suspense>
  );
}
