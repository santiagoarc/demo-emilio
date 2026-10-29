import { redirect } from "next/navigation";

// The 3D monitor is now the aviary Habitat map.
export default function AviaryMonitorPage() {
  redirect("/aviary/map");
}
