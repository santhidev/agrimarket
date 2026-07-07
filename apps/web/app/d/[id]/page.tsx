import { redirect } from "next/navigation";

// Share deeplink → canonical detail (Issue 08).
//
// `/d/:id` is the short, share-friendly URL for a demand (LINE/Facebook). It
// 302s to the canonical `/demands/:id` detail page, which renders OPEN demands
// publicly and hidden demands as 404 (RLS), so the share target sees exactly
// what their session allows. The 302 (not 301) keeps the share URL stable
// while letting the destination evolve.
export default async function DemandShareRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/demands/${id}`);
}
