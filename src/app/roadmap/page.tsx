import { RoadmapView } from "@/features/platform/RoadmapView";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function RoadmapPage() {
  return <RoadmapView />;
}
