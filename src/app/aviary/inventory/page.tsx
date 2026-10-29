import { redirect } from "next/navigation";

// Renamed to Species, like the penguin area.
export default function AviaryInventoryPage() {
  redirect("/aviary/species");
}
