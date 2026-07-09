// Standalone cleanup (Issue 19) — `pnpm test:e2e:cleanup`.
// Runs the same cleanup as globalTeardown, for manual recovery when a test run
// failed mid-flow and left demands/offers behind.

import { createInsForgeAdminClient } from "../../app/lib/insforge-admin";
import { TEST } from "./test-ids";

async function main() {
  const admin = createInsForgeAdminClient();
  const { data: profiles } = await admin.database
    .from("profiles")
    .select("id, phone")
    .in("phone", [TEST.buyer.phone, TEST.seller.phone]);
  const rows =
    (profiles as unknown as { id: string; phone: string }[] | null) ?? [];

  if (rows.length === 0) {
    console.log("No test users found — nothing to clean.");
    return;
  }

  const buyerId = rows.find((r) => r.phone === TEST.buyer.phone)?.id;
  const sellerIds = rows
    .filter((r) => r.phone === TEST.seller.phone)
    .map((r) => r.id);

  if (sellerIds.length > 0) {
    const { error } = await admin.database
      .from("offers")
      .delete()
      .in("seller_id", sellerIds);
    console.log(`offers cleanup: ${error ? error.message : "ok"}`);
  }
  if (buyerId) {
    const { error } = await admin.database
      .from("demands")
      .delete()
      .eq("buyer_id", buyerId);
    console.log(`demands cleanup: ${error ? error.message : "ok"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
