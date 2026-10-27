import { OverviewView } from "@/features/overview/OverviewView";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function PenguinOverviewPage() {
  return <OverviewView />;
}
