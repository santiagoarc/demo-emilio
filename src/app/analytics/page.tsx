import { AnalyticsView } from "@/features/analytics/AnalyticsView";

// La demo genera sus datos en el navegador; no hay UI que validar en el servidor.
export const instant = false;

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
