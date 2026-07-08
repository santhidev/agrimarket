import { NextResponse } from "next/server";
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { shouldDeclineOffer, NotificationType } from "@agrimarket/shared";
import { OFFER_SELECT, type OfferRow } from "@/app/api/offers/mapping";
import { seedNotifications } from "@/app/lib/notifications";

// POST /api/cron/offers/decline (Issue 15).
//
// Recurring auto-decline: flips PENDING_SELLER_CONFIRMATION offers whose
// updated_at is ≥ 24h old to DECLINED, then seeds an 'offer.auto_declined'
// notification for each seller (CONTEXT.md "Seller ยืนยันขายใน 24 ชม. → เกิน =
// auto DECLINED"). Triggered by an InsForge managed cron schedule
// (`0 * * * *`, hourly) that POSTs this route with an X-Cron-Secret header —
// not a user route, so there's no session and no RLS: the admin client
// (service-role INSFORGE_API_KEY) bypasses RLS to reach every seller's rows.
//
// Idempotency: the SQL pre-filters status='PENDING_SELLER_CONFIRMATION'; the
// pure shouldDeclineOffer predicate re-checks each row's age before UPDATE. A
// row that raced (seller confirmed between SELECT and UPDATE) is skipped by the
// status check, and a row a prior tick already moved is no longer
// PENDING_SELLER_CONFIRMATION so the next SELECT excludes it. Re-running a tick
// is a no-op — no duplicate notifications. Mirrors the demand expire/complete
// jobs from Issue 09.
//
// The notification payload carries the offer id + demand id + product name so
// #17's UI can render a row ("ข้อเสนอของคุณในประกาศมะม่วงน้ำดอกไม้ หมดเวลายืนยัน")
// without a second round-trip.
export async function POST(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createInsForgeAdminClient();

  // Coarse filter in SQL — uses the offers_demand_idx (demand_id, status). We
  // pull the joined demand + product so the notification payload has the
  // product name without a follow-up query. The nested demand join resolves
  // via the single offers → demands FK (PostgREST matches by table).
  const { data, error } = await admin.database
    .from("offers")
    .select(
      `${OFFER_SELECT}, demand:demands(id, buyer_id, product:products(name, unit))`
    )
    .eq("status", "PENDING_SELLER_CONFIRMATION");

  if (error) {
    console.error("[cron/offers/decline] select failed", error);
    return NextResponse.json(
      { error: "Failed to load offers" },
      { status: 500 }
    );
  }

  // The joined row shape: the offer columns + a nested demand object.
  type DeclineCandidateRow = OfferRow & {
    demand: {
      id: string;
      buyer_id: string;
      product: { name: string; unit: string };
    } | null;
  };

  const now = new Date();
  const rows = (data ?? []) as unknown as DeclineCandidateRow[];
  // OfferRow columns are snake_case; the predicate speaks camelCase (shared
  // convention). Map the fields the predicate reads — same shape as the demand
  // complete job's shouldCompleteDemand adapter.
  const targets = rows.filter((row) =>
    shouldDeclineOffer(
      { status: row.status, updatedAt: row.updated_at },
      now
    )
  );

  let declined = 0;
  for (const row of targets) {
    const { error: updErr } = await admin.database
      .from("offers")
      .update({ status: "DECLINED" })
      .eq("id", row.id);

    if (updErr) {
      // Log + keep going — one bad row shouldn't abort the whole tick. The row
      // stays PENDING_SELLER_CONFIRMATION and the next tick retries it.
      console.error(
        `[cron/offers/decline] update ${row.id} failed`,
        updErr
      );
      continue;
    }

    const productName = row.demand?.product.name ?? null;
    await seedNotifications(admin, [
      {
        userId: row.seller_id,
        type: NotificationType.OfferAutoDeclined,
        payload: {
          offerId: row.id,
          demandId: row.demand?.id ?? null,
          productName,
        },
      },
    ]);
    declined += 1;
  }

  console.info(`[cron/offers/decline] declined ${declined} offers`);
  return NextResponse.json({ declined });
}
