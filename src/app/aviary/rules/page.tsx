import { redirect } from "next/navigation";

// Retired section: the aviary menu is Map, Species, Individuals, Trees, Teams and Health follow-up.
export default function AviaryRulesPage() {
  redirect("/aviary/health");
}
