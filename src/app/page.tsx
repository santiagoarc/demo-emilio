import { OverviewView } from "@/features/overview/OverviewView";

// La demo genera sus datos en el navegador; no hay UI que validar en el servidor.
export const instant = false;

export default function Home() {
  return <OverviewView />;
}
