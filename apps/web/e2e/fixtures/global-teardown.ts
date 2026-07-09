import { createInsForgeAdminClient } from "../../app/lib/insforge-admin";
import { TEST } from "./test-ids";

// globalTeardown (Issue 19): cleans up the demands/offers created during this
// run. Users are fixed + reused (NOT deleted). Runs after the spec regardless
// of pass/fail. If it fails itself, a standalone `pnpm test:e2e:cleanup` is
// the manual recovery path.

export default async function globalTeardown() {
  const admin = createInsForgeAdminClient();

  // Find the buyer + seller profile ids.
  const { data: profiles } = await admin.database
    .from("profiles")
    .select("id, phone")
    .in("phone", [TEST.buyer.phone, TEST.seller.phone]);
  const rows =
    (profiles as unknown as { id: string; phone: string }[] | null) ?? [];
  if (rows.length === 0) return;

  const buyerId = rows.find((r) => r.phone === TEST.buyer.phone)?.id;
  const sellerIds = rows
    .filter((r) => r.phone === TEST.seller.phone)
    .map((r) => r.id);

  // Delete offers the seller made first (in case the FK from offers→demands is
  // RESTRICT, which would block demand deletion). If it's CASCADE, this is a
  // harmless no-op precursor.
  if (sellerIds.length > 0) {
    const { error: offerErr } = await admin.database
      .from("offers")
      .delete()
      .in("seller_id", sellerIds);
    if (offerErr)
      console.error("[globalTeardown] offer cleanup failed", offerErr);
  }

  // Delete demands owned by the buyer. If offers had a CASCADE FK to demands,
  // the offer delete above was redundant but harmless; if RESTRICT, it was
  // required.
  if (buyerId) {
    const { error: demandErr } = await admin.database
      .from("demands")
      .delete()
      .eq("buyer_id", buyerId);
    if (demandErr)
      console.error("[globalTeardown] demand cleanup failed", demandErr);
  }
}
