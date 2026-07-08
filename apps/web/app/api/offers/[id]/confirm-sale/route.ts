import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { seedNotifications } from "@/app/lib/notifications";
import {
  canSellerConfirm,
  OfferStatus,
  NotificationType,
} from "@agrimarket/shared";
import {
  OFFER_SELECT,
  mapOffer,
  type OfferRow,
} from "@/app/api/offers/mapping";

// POST /api/offers/:id/confirm-sale — seller confirms a sale (Issue 14).
//
// After the buyer selects an offer (POST /api/demands/:id/select →
// PENDING_SELLER_CONFIRMATION), the seller confirms they'll sell the chosen
// quantity at their offered price → CONFIRMED. This is the seller's "yes" in
// the handshake; once every selected offer is CONFIRMED, #15's match endpoint
// can lock the deal. Decline is the symmetric "no" (decline-sale → DECLINED).
//
// Gate chain: 401 (no session) → 404 (missing/not visible) → 403 (not seller)
// → 409 (not PENDING_SELLER_CONFIRMATION via canSellerConfirm) → 200. Same
// .single() null-then-error ordering + seller owner gate as the offer
// PATCH/DELETE routes (#10). The UPDATE runs as the seller (RLS
// offers_update_seller_own).
//
// #17 NOTE: the "buyer notified" event is emitted by #17 (notifications +
// push). This route only flips the status; #17 will add the confirm/decline
// notification consumer. Left as a TODO so #17 has the seam.
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

  // Load first to distinguish 404 (missing/not visible) from 403 (not seller)
  // from 409 (wrong state). Same .single() null-then-error ordering as #10.
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
  if (!canSellerConfirm(row.status as never)) {
    return NextResponse.json(
      { error: `Offer is ${row.status}, can only confirm a PENDING_SELLER_CONFIRMATION offer` },
      { status: 409 }
    );
  }

  const { data: updated, error: updErr } = await client.database
    .from("offers")
    .update({ status: OfferStatus.Confirmed })
    .eq("id", id)
    .select(OFFER_SELECT)
    .single();

  if (updErr) {
    return NextResponse.json(
      { error: "Failed to confirm offer" },
      { status: 500 }
    );
  }

  const next = (updated as unknown as OfferRow | null) ?? null;

  // Issue 17: notify the demand's buyer that the seller confirmed. The status
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
          type: NotificationType.OfferSellerConfirmed,
          payload: { productName: demand.product.name },
        },
      ]);
    }
  } catch (e) {
    console.error("[offers/confirm-sale] notification seed failed", e);
  }

  return NextResponse.json({ offer: next ? mapOffer(next) : null });
}
