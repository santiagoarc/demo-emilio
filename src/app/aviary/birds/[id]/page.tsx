import { redirect } from "next/navigation";

// A bird's card lives in the monitor, next to the map.
export default async function AviaryBirdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/aviary?bird=${encodeURIComponent(id)}`);
}
