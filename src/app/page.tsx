import { PlatformOverview } from "@/features/platform/PlatformOverview";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

export default function Home() {
  return <PlatformOverview />;
}
