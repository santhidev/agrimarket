import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { seedNotifications } from "@/app/lib/notifications";
import {
  canSellerDecline,
  OfferStatus,
  NotificationType,
} from "@agrimarket/shared";
import {
  OFFER_SELECT,
  mapOffer,
  type OfferRow,
} from "@/app/api/offers/mapping";

// POST /api/offers/:id/decline-sale — seller declines a sale (Issue 14).
//
// The seller's "no" in the handshake: a PENDING_SELLER_CONFIRMATION offer
// (just selected by the buyer) flips to DECLINED. The buyer then re-selects
// (POST /api/demands/:id/select again), which reverts prior CONFIRMED/PENDING
// offers to ACTIVE and lets the buyer pick a fresh set. DECLINED is terminal
// for this offer — the unique index on (demand_id, seller_id) means the
// seller can't re-submit on the same demand; they're out of this round.
//
// Gate chain: 401 → 404 → 403 (not seller) → 409 (not PENDING_SELLER_
// CONFIRMATION via canSellerDecline) → 200. Symmetric to confirm-sale; the
// UPDATE runs as the seller (RLS offers_update_seller_own).
//
// #17 NOTE: the "buyer notified" event is emitted by #17 (notifications +
// push). Same seam as confirm-sale.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  const { data: existing, error: findErr } = await client.database
    .from("offers")
    .select(OFFER_SELECT)
    .eq("id", id)
    .single();

  const row = (existing as unknown as OfferRow | null) ?? null;
  if (!row) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }
  if (findErr) {
    return NextResponse.json(
      { error: "Failed to load offer" },
      { status: 500 }
    );
  }
  if (row.seller_id !== current.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canSellerDecline(row.status as never)) {
    return NextResponse.json(
      { error: `Offer is ${row.status}, can only decline a PENDING_SELLER_CONFIRMATION offer` },
      { status: 409 }
    );
  }

  const { data: updated, error: updErr } = await client.database
    .from("offers")
    .update({ status: OfferStatus.Declined })
    .eq("id", id)
    .select(OFFER_SELECT)
    .single();

  if (updErr) {
    return NextResponse.json(
      { error: "Failed to decline offer" },
      { status: 500 }
    );
  }

  const next = (updated as unknown as OfferRow | null) ?? null;

  // Issue 17: notify the demand's buyer that the seller declined. The status
  // flip already succeeded; notification failure is logged, not thrown.
  try {
    const { data: d } = await client.database
      .from("demands")
      .select("buyer_id, product:products(name)")
      .eq("id", row.demand_id)
      .single();
    const demand = (d as unknown as { buyer_id: string; product: { name: string } } | null) ?? null;
    if (demand?.buyer_id && demand.product?.name) {
      await seedNotifications(createInsForgeAdminClient(), [
        {
          userId: demand.buyer_id,
          type: NotificationType.OfferSellerDeclined,
          payload: { productName: demand.product.name },
        },
      ]);
    }
  } catch (e) {
    console.error("[offers/decline-sale] notification seed failed", e);
  }

  return NextResponse.json({ offer: next ? mapOffer(next) : null });
}
