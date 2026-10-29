import { redirect } from "next/navigation";

// Retired section: trees are opened from the map.
export default function AviaryTreesPage() {
  redirect("/aviary/map");
}
