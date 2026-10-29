import { redirect } from "next/navigation";

// A bird's card lives on the Habitat map, next to the 3D view.
export default async function AviaryBirdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/aviary/map?bird=${encodeURIComponent(id)}`);
}
