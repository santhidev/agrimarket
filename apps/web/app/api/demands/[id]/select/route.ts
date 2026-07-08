import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import {
  canEditDemand,
  selectOffersSchema,
  isValidSelectionQuantities,
  OfferStatus,
  type SelectionItem,
} from "@agrimarket/shared";
import {
  DEMAND_SELECT,
  mapDemand,
  type DemandRow,
} from "@/app/api/demands/mapping";

// POST /api/demands/:id/select — buyer selects a combination of offers
// (Issue 14).
//
// The buyer picks the offers (with accepted quantities) they want to proceed
// with; chosen offers move to PENDING_SELLER_CONFIRMATION and set
// accepted_quantity. Sellers then confirm (POST /api/offers/:id/confirm-sale)
// or decline (decline-sale). On a re-select (e.g. after a seller declined),
// every prior PENDING_SELLER_CONFIRMATION and CONFIRMED offer on the demand
// reverts to ACTIVE first, so the new selection starts clean and every chosen
// offer must be re-confirmed (CONTEXT.md "วนกลับเลือกใหม่ → CONFIRMED offers
// ต้องเลือกใหม่ + ยืนยันใหม่"). ACTIVE offers not in the new selection stay
// ACTIVE (still competing); #14 never sets REJECTED — that's #15's match-lock.
//
// Gate chain: 401 (no session) → 404 (demand missing/hidden under RLS) → 403
// (not the buyer) → 409 (not OPEN via canEditDemand) → 400 (bad body OR
// selection invalid: offer not on this demand, wrong state, acceptedQty >
// offered, sum > demand.quantity, duplicates) → 200. Same .single()
// null-data-then-error ordering + buyer owner gate as the demand
// PATCH/DELETE/counter-offer routes.
//
// The UPDATE runs as the buyer (RLS offers_update_buyer_via_demand). Column
// scope is row-level only — the route writes status + accepted_quantity and
// nothing else as the buyer (price/quantity/photos stay seller-only).
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

  // Load the demand (with nested offers) to distinguish 404 from 403 from 409.
  // Same .single() null-data-then-error ordering as the sibling routes.
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
      { error: `Demand is ${row.status}, can't select offers on a closed demand` },
      { status: 409 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = selectOffersSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid selection", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Index the demand's offers by id for lookup. The buyer sees all offers on
  // their demand (RLS), so any offerId in the body that isn't here is either
  // from another demand or doesn't exist → 400.
  const offersById = new Map(
    (row.offers ?? []).map((o) => [o.id, o])
  );

  // Validate every selected offer belongs to this demand AND is in a state the
  // handshake allows. An offer may be selected if it's ACTIVE, or if it's
  // PENDING/CONFIRMED (the re-select path resets these to ACTIVE first). Any
  // other status (MATCHED/WITHDRAWN/REJECTED/EXPIRED/CANCELLED/DECLINED) is
  // out of the running.
  const selectionItems: SelectionItem[] = [];
  for (const item of parsed.data.offers) {
    const offer = offersById.get(item.offerId);
    if (!offer) {
      return NextResponse.json(
        { error: `Offer ${item.offerId} does not belong to this demand` },
        { status: 400 }
      );
    }
    if (
      offer.status !== OfferStatus.Active &&
      offer.status !== OfferStatus.PendingSellerConfirmation &&
      offer.status !== OfferStatus.Confirmed
    ) {
      return NextResponse.json(
        {
          error: `Offer ${item.offerId} is ${offer.status}, can't be selected`,
        },
        { status: 400 }
      );
    }
    selectionItems.push({
      offerId: item.offerId,
      acceptedQuantity: item.acceptedQuantity,
      offerQuantity: offer.quantity,
    });
  }

  // Pure validation of the sum + per-offer + uniqueness constraints
  // (CONTEXT.md: sum(quantity) > 0 และ ≤ demand.quantity; each ≤ offered).
  if (!isValidSelectionQuantities(row.quantity, selectionItems)) {
    return NextResponse.json(
      { error: "Selection invalid: total must be > 0 and ≤ demand quantity, each acceptedQuantity ≤ offer quantity, no duplicates" },
      { status: 400 }
    );
  }

  // --- Apply the selection -------------------------------------------------
  //
  // Two UPDATEs, both as the buyer (RLS offers_update_buyer_via_demand):
  //   1. Reset: every PENDING_SELLER_CONFIRMATION + CONFIRMED offer on this
  //      demand reverts to ACTIVE with accepted_quantity = NULL. This makes
  //      re-select symmetric — a prior CONFIRMED offer must be re-confirmed
  //      after the buyer picks it again.
  //   2. Select: the chosen offers → PENDING_SELLER_CONFIRMATION with their
  //      accepted_quantity.
  //
  // Order matters: reset first, then select, so a re-selected offer ends up
  // PENDING (not left ACTIVE by the reset).

  const { error: resetErr } = await client.database
    .from("offers")
    .update({ status: OfferStatus.Active, accepted_quantity: null })
    .eq("demand_id", id)
    .in("status", [
      OfferStatus.PendingSellerConfirmation,
      OfferStatus.Confirmed,
    ]);

  if (resetErr) {
    return NextResponse.json(
      { error: "Failed to reset prior selection" },
      { status: 500 }
    );
  }

  // Apply each selected offer's status + accepted_quantity. One UPDATE per
  // offer because accepted_quantity differs per row; n is tiny (≤ demand's
  // sellers) so the round-trip cost is negligible.
  for (const item of parsed.data.offers) {
    const { error: selErr } = await client.database
      .from("offers")
      .update({
        status: OfferStatus.PendingSellerConfirmation,
        accepted_quantity: item.acceptedQuantity,
      })
      .eq("id", item.offerId);

    if (selErr) {
      return NextResponse.json(
        { error: "Failed to apply selection" },
        { status: 500 }
      );
    }
  }

  // Re-read the demand so the response reflects the new offer states.
  const { data: refreshed } = await client.database
    .from("demands")
    .select(DEMAND_SELECT)
    .eq("id", id)
    .single();

  const next = (refreshed as unknown as DemandRow | null) ?? null;
  return NextResponse.json({ demand: next ? mapDemand(next) : null });
}
