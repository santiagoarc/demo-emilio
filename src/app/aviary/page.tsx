import { redirect } from "next/navigation";

// The aviary starts at its overview.
export default function AviaryPage() {
  redirect("/aviary/overview");
}
