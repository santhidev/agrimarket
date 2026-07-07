// Manual verification script for Issues 11 + 12 (counter-offer + competitive
// bidding view). Runs against the dev DB via the admin client (bypasses RLS) to
// simulate the route logic end-to-end, since the browser MCP is unavailable.
//
// Scenario:
//   - Demand D (OPEN, buyer = admin phone 0899999901) — already exists.
//   - Seller A (0812345678, KYC approved) offers at 25 baht.
//   - Seller B (0855555501, KYC set to Approved for this test) offers at 18.
//   - Buyer sets counter-offer at 20.
//   - Expect: Seller A (25 > 20) NOT accepted (hidden from competitors);
//             Seller B (18 ≤ 20) accepted (visible to competitors).
//   - Then verify the pure predicate matches the DB helper.
//
// Run: node scripts/verify-counter-offer.mjs
// Cleanup: resets KYC on 0855555501 back to None, deletes the test offers +
// clears the counter-offer. Idempotent — safe to re-run.

import { createAdminClient } from "@insforge/sdk";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
if (!baseUrl || !apiKey) {
  console.error("Missing NEXT_PUBLIC_INSFORGE_URL or INSFORGE_API_KEY");
  process.exit(1);
}

const admin = createAdminClient({ baseUrl, apiKey });
const db = admin.database;

const DEMAND_ID = "6ca52397-23f9-4daa-9d75-d113fe68d6f4"; // OPEN demand
const SELLER_A_PHONE = "0812345678"; // KYC Approved already
const SELLER_B_PHONE = "0855555501"; // need to set Approved temporarily

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

async function main() {
  // --- Setup: fetch seller ids, set KYC, clean prior test offers ----------
  const { data: profiles } = await db
    .from("profiles")
    .select("id, phone, kyc_status")
    .in("phone", [SELLER_A_PHONE, SELLER_B_PHONE]);
  const sellerA = profiles.find((p) => p.phone === SELLER_A_PHONE);
  const sellerB = profiles.find((p) => p.phone === SELLER_B_PHONE);
  if (!sellerA || !sellerB) {
    console.error("Could not find both test sellers", { sellerA, sellerB });
    process.exit(1);
  }

  const prevKycB = sellerB.kyc_status;
  console.log(`Seller A (${SELLER_A_PHONE}) = ${sellerA.id}, kyc=${sellerA.kyc_status}`);
  console.log(`Seller B (${SELLER_B_PHONE}) = ${sellerB.id}, kyc=${sellerB.kyc_status}`);

  // Temporarily approve seller B so the offer insert (if it went through the
  // route) would pass. We insert directly via admin here, so KYC is informational.
  if (sellerB.kyc_status !== "Approved") {
    await db.from("profiles").update({ kyc_status: "Approved" }).eq("id", sellerB.id);
    console.log("Temporarily set Seller B KYC → Approved");
  }

  // Clean any prior test offers from these sellers on this demand.
  await db
    .from("offers")
    .delete()
    .eq("demand_id", DEMAND_ID)
    .in("seller_id", [sellerA.id, sellerB.id]);

  // Clear any prior counter-offer.
  await db
    .from("demands")
    .update({ counter_offer_price: null, counter_offer_at: null })
    .eq("id", DEMAND_ID);

  // --- Insert two offers (admin bypasses RLS + unique check) --------------
  // Seller A at 25 (above the upcoming counter-offer of 20 → NOT accepted)
  // Seller B at 18 (at/below 20 → accepted)
  const { data: offers, error: offerErr } = await db
    .from("offers")
    .insert([
      {
        demand_id: DEMAND_ID,
        seller_id: sellerA.id,
        price_per_unit: 25,
        quantity: 50,
        pickup_lat: 13.7563,
        pickup_lng: 100.5018,
        ready_date: "2099-12-31",
      },
      {
        demand_id: DEMAND_ID,
        seller_id: sellerB.id,
        price_per_unit: 18,
        quantity: 60,
        pickup_lat: 13.7563,
        pickup_lng: 100.5018,
        ready_date: "2099-12-31",
      },
    ])
    .select("id, seller_id, price_per_unit");
  if (offerErr || !offers) {
    console.error("Offer insert failed", offerErr);
    process.exit(1);
  }
  console.log("Inserted test offers:", offers);

  // --- #12: buyer sets counter-offer at 20 (simulates the route UPDATE) ----
  const { error: counterErr } = await db
    .from("demands")
    .update({ counter_offer_price: 20, counter_offer_at: new Date().toISOString() })
    .eq("id", DEMAND_ID);
  if (counterErr) {
    console.error("Counter-offer update failed", counterErr);
    process.exit(1);
  }
  console.log("Set counter_offer_price = 20");

  // --- Verify the DB helper is_counter_offer_accepted ----------------------
  const { data: aCheck } = await db
    .rpc("is_counter_offer_accepted", { offer_price: 25, demand_uuid: DEMAND_ID });
  const { data: bCheck } = await db
    .rpc("is_counter_offer_accepted", { offer_price: 18, demand_uuid: DEMAND_ID });
  assert(aCheck === false, "DB helper: seller A (25 > 20) NOT accepted");
  assert(bCheck === true, "DB helper: seller B (18 ≤ 20) accepted");

  // --- Verify the pure predicate (mirrors shared package) -----------------
  const isAccepted = (offerPrice, counter) =>
    counter === null ? false : offerPrice <= counter;
  assert(isAccepted(25, 20) === false, "Predicate: seller A (25 > 20) NOT accepted");
  assert(isAccepted(18, 20) === true, "Predicate: seller B (18 ≤ 20) accepted");
  assert(isAccepted(20, 20) === true, "Predicate: tie (20 = 20) accepted");
  assert(isAccepted(18, null) === false, "Predicate: no counter-offer → not accepted");

  // --- Cleanup ------------------------------------------------------------
  await db
    .from("offers")
    .delete()
    .eq("demand_id", DEMAND_ID)
    .in("seller_id", [sellerA.id, sellerB.id]);
  await db
    .from("demands")
    .update({ counter_offer_price: null, counter_offer_at: null })
    .eq("id", DEMAND_ID);
  if (prevKycB !== "Approved") {
    await db
      .from("profiles")
      .update({ kyc_status: prevKycB })
      .eq("id", sellerB.id);
    console.log(`Restored Seller B KYC → ${prevKycB}`);
  }
  console.log("Cleanup complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
