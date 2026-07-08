import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { seedNotifications } from "@/app/lib/notifications";
import {
  canEditDemand,
  counterOfferSchema,
  NotificationType,
} from "@agrimarket/shared";
import {
  DEMAND_SELECT,
  mapDemand,
  type DemandRow,
} from "@/app/api/demands/mapping";

// POST /api/demands/:id/counter-offer — buyer sets a desired price (Issue 12).
//
// A counter-offer does NOT change any offer's status — sellers respond by
// editing their own offer price down (reusing PATCH from #10). When a seller's
// price drops to ≤ the counter-offer price, they are "accepted" and their price
// becomes visible to competitors in the competitive bidding view (#11).
// Unlimited rounds; the latest write wins (overwrites the previous price/at).
//
// Gate chain: 401 (no session) → 404 (demand missing/hidden under RLS) → 403
// (not the buyer) → 409 (not OPEN via canEditDemand) → 400 (bad body) → 200.
// The OPEN-only gate matches the demand edit/cancel rule: a closed demand
// (MATCHED/COMPLETED/EXPIRED/CANCELLED) is past negotiation. The buyer owner
// gate runs after the RLS read so a non-owner's hidden non-OPEN row surfaces as
// 404 (no existence leak) — same .single() null-then-error ordering as the
// demand PATCH/DELETE routes.
//
// #17 NOTE: the "seller notified" event is emitted by #17 (notifications +
// push). This route only persists the counter-offer; the #09 cron already
// seeds notifications of other types, and #17 will add the counter-offer
// notification consumer. Left as a TODO so #17 has the seam.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  // Load first to distinguish 404 (missing/hidden) from 403 (not buyer) from
  // 409 (wrong state). Same .single() null-data-then-error ordering as demands.
  const { data: existing, error: findErr } = await client.database
    .from("demands")
    .select(DEMAND_SELECT)
    .eq("id", id)
    .single();

  const row = (existing as unknown as DemandRow | null) ?? null;
  if (!row) {
    return NextResponse.json({ error: "Demand not found" }, { status: 404 });
  }
  if (findErr) {
    return NextResponse.json(
      { error: "Failed to load demand" },
      { status: 500 }
    );
  }
  if (row.buyer_id !== current.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canEditDemand(row.status as never)) {
    return NextResponse.json(
      { error: `Demand is ${row.status}, can't accept a counter-offer` },
      { status: 409 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = counterOfferSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid counter-offer", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Set the latest counter-offer price + timestamp. updated_at is bumped so the
  // demand list reflects the recent activity. The buyer-side UPDATE RLS policy
  // (demands_update_owner_or_admin) permits this write.
  const { data: updated, error: updErr } = await client.database
    .from("demands")
    .update({
      counter_offer_price: parsed.data.pricePerUnit,
      counter_offer_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(DEMAND_SELECT)
    .single();

  if (updErr) {
    return NextResponse.json(
      { error: "Failed to set counter-offer" },
      { status: 500 }
    );
  }

  const next = (updated as unknown as DemandRow | null) ?? null;

  // Issue 17: notify every seller with an offer on this demand that the buyer
  // sent a counter-offer. The counter-offer UPDATE already succeeded; a
  // notification failure is logged, not thrown.
  try {
    const { data: offerRows } = await client.database
      .from("offers")
      .select("seller_id")
      .eq("demand_id", id);

    const sellerIds = Array.from(
      new Set(
        ((offerRows ?? []) as unknown as { seller_id: string }[]).map(
          (o) => o.seller_id
        )
      )
    );

    if (sellerIds.length > 0 && row.product?.name) {
      await seedNotifications(
        createInsForgeAdminClient(),
        sellerIds.map((sellerId) => ({
          userId: sellerId,
          type: NotificationType.CounterOfferReceived,
          payload: {
            productName: row.product.name,
            price: parsed.data.pricePerUnit,
            unit: row.product.unit,
          },
        }))
      );
    }
  } catch (e) {
    console.error("[demands/counter-offer] notification seed failed", e);
  }

  return NextResponse.json({ demand: next ? mapDemand(next) : null });
}
