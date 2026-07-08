import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import {
  DemandStatus,
  OfferStatus,
  allSelectedOffersConfirmed,
  shouldRejectOnMatch,
} from "@agrimarket/shared";
import {
  DEMAND_SELECT,
  mapDemand,
  type DemandRow,
} from "@/app/api/demands/mapping";

// POST /api/demands/:id/match — buyer locks the deal (Issue 15).
//
// Once every chosen seller has confirmed (all selected offers are CONFIRMED),
// the buyer confirms self-pickup to lock the deal. The Demand flips to MATCHED
// (CONTEXT.md "MATCHED = ระบบให้เบอร์ติดต่อ → buyer กับ seller คุยกันเอง"), the
// selected offers flip to MATCHED, and any leftover in-handshake offers
// (PENDING_SELLER_CONFIRMATION / CONFIRMED that aren't part of the matched
// selection) flip to REJECTED. pending_quantity drops to 0 — all demand
// quantity is now committed. A MATCHED demand then feeds Issue 09's
// auto-complete job (MATCHED + 7d → COMPLETED).
//
// After match the buyer reads the matched sellers' phone numbers via
// GET /api/demands/:id/contacts (#15).
//
// Gate chain: 401 (no session) → 404 (demand missing/hidden under RLS) → 403
// (not the buyer) → 409 (not OPEN — can only lock an in-flight demand) → 409
// (precondition: not every selected offer is CONFIRMED yet) → 200. Same
// .single() null-data-then-error ordering + buyer owner gate as the select
// route (#14).
//
// The UPDATEs run as the buyer (RLS offers_update_buyer_via_demand, same as
// the select route). No notification is seeded here — #17 owns the
// "demand.matched"/"offer.matched"/"offer.rejected" push (mirrors the #14
// confirm-sale route, which only flips status and leaves the buyer push to #17).
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
  if (row.status !== DemandStatus.Open) {
    return NextResponse.json(
      { error: `Demand is ${row.status}, can only match an OPEN demand` },
      { status: 409 }
    );
  }

  // Match precondition: there's at least one chosen offer and every chosen
  // offer is CONFIRMED. "Chosen" = PENDING_SELLER_CONFIRMATION or CONFIRMED
  // (the select route's reset step clears every other in-handshake offer back
  // to ACTIVE, so at match time the chosen set is exactly these statuses).
  const offers = (row.offers ?? []) as { status: string }[];
  if (!allSelectedOffersConfirmed(offers)) {
    return NextResponse.json(
      {
        error:
          "Can't match yet: select offers first and wait for every chosen seller to confirm",
      },
      { status: 409 }
    );
  }

  // --- Apply the lock -------------------------------------------------------
  //
  // Three UPDATEs, all as the buyer (RLS offers_update_buyer_via_demand):
  //   1. The matched set: every CONFIRMED offer that was selected
  //      (accepted_quantity IS NOT NULL — set by the select route) → MATCHED.
  //   2. Safety net: any leftover PENDING_SELLER_CONFIRMATION / CONFIRMED
  //      offer (shouldRejectOnMatch) that isn't part of the matched set →
  //      REJECTED. Normally the select route's reset has cleared these to
  //      ACTIVE, but shouldRejectOnMatch defends against a race / drift.
  //   3. The demand → MATCHED, pending_quantity = 0 (Issue 14 left
  //      pending_quantity unwired; match is the real commitment point).
  //
  // Order: match first, then reject, then demand. The match + reject sets are
  // disjoint by status filter (CONFIRMED-with-accepted_quantity vs. everything
  // in-handshake), so the order is defensive, not load-bearing.

  const { error: matchErr } = await client.database
    .from("offers")
    .update({ status: OfferStatus.Matched })
    .eq("demand_id", id)
    .eq("status", OfferStatus.Confirmed)
    .not("accepted_quantity", "is", null);

  if (matchErr) {
    return NextResponse.json(
      { error: "Failed to match selected offers" },
      { status: 500 }
    );
  }

  // Safety-net reject of any in-handshake offers not in the matched set.
  // shouldRejectOnMatch is the pure rule (PENDING_SELLER_CONFIRMATION +
  // CONFIRMED); the .in() mirrors it in SQL. A CONFIRMED offer with no
  // accepted_quantity (somehow) is the realistic target.
  const { error: rejectErr } = await client.database
    .from("offers")
    .update({ status: OfferStatus.Rejected })
    .eq("demand_id", id)
    .in("status", [
      OfferStatus.PendingSellerConfirmation,
      OfferStatus.Confirmed,
    ]);

  if (rejectErr) {
    return NextResponse.json(
      { error: "Failed to reject unmatched offers" },
      { status: 500 }
    );
  }

  const { error: demandErr } = await client.database
    .from("demands")
    .update({ status: DemandStatus.Matched, pending_quantity: 0 })
    .eq("id", id);

  if (demandErr) {
    return NextResponse.json(
      { error: "Failed to mark demand as matched" },
      { status: 500 }
    );
  }

  // Re-read the demand so the response reflects the new offer + demand states.
  const { data: refreshed } = await client.database
    .from("demands")
    .select(DEMAND_SELECT)
    .eq("id", id)
    .single();

  const next = (refreshed as unknown as DemandRow | null) ?? null;
  return NextResponse.json({ demand: next ? mapDemand(next) : null });
}
