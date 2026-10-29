import { redirect } from "next/navigation";

// Retired section: proposed rules are no longer part of the penguin menu.
export default function PenguinRulesPage() {
  redirect("/penguins/overview");
}
