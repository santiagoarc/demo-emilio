import { redirect } from "next/navigation";

// Only two areas remain (Penguins, Aviary); Penguins opens first.
export default function Home() {
  redirect("/penguins/overview");
}
