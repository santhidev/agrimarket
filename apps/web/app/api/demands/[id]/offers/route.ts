import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { isCounterOfferAccepted } from "@agrimarket/shared";
import {
  OFFER_SELECT,
  mapOffer,
  type OfferRow,
} from "@/app/api/offers/mapping";

// GET /api/demands/:id/offers — competitive bidding view (Issue 11).
//
// Role-shaped response:
//   - Buyer of the demand: sees every offer with full detail (price, quantity,
//     grade, photos, location, ready date) — they're evaluating all sellers.
//   - Seller: sees their own offer (full detail) + competitors whose price has
//     "accepted" the buyer's current counter-offer (#12). A competitor's price
//     is hidden until their price ≤ the counter-offer price; before any
//     counter-offer exists, no competitor is visible. The seller adjusts their
//     own price inline via PATCH /api/offers/:id (#10).
//
// RLS enforces the visibility rule at the DB layer (offers_select_buyer_or_
// seller_or_admin + offers_select_competitor_accepted): a seller's SELECT
// returns only their own rows + accepted competitors, so the route can trust
// the result without re-filtering. The route still shapes the response per role
// and joins the seller's phone (the only identifier on profiles — no name
// column) so the buyer can see who each offer is from.
//
// Gate: 401 (anon) → 404 (demand missing/hidden). OPEN demands are public, so a
// seller can see the competitive view on any OPEN demand; a non-OPEN demand is
// owner-or-admin only (RLS hides it → 404).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  // Load the demand to (a) confirm the caller can see it (404 if hidden under
  // RLS) and (b) read counter_offer_price for the response. A seller only needs
  // the counter-offer price (not buyer/location) so a minimal select is enough.
  const { data: demand, error: demandErr } = await client.database
    .from("demands")
    .select("id, buyer_id, status, counter_offer_price")
    .eq("id", id)
    .single();

  const demandRow =
    (demand as unknown as {
      id: string;
      buyer_id: string;
      status: string;
      counter_offer_price: string | number | null;
    } | null) ?? null;
  if (!demandRow) {
    return NextResponse.json({ error: "Demand not found" }, { status: 404 });
  }
  if (demandErr) {
    return NextResponse.json(
      { error: "Failed to load demand" },
      { status: 500 }
    );
  }

  const counterOfferPrice =
    demandRow.counter_offer_price === null
      ? null
      : typeof demandRow.counter_offer_price === "string"
        ? Number(demandRow.counter_offer_price)
        : demandRow.counter_offer_price;

  // Load offers under the caller's RLS. A buyer sees all offers on their demand;
  // a seller sees their own offers + accepted competitors (RLS). Join the
  // seller's phone via profiles so the buyer can identify each seller.
  const { data: offerData, error: offerErr } = await client.database
    .from("offers")
    .select(`${OFFER_SELECT}, seller:profiles!offers_seller_profile_fkey(phone)`)
    .eq("demand_id", id)
    .order("created_at", { ascending: true });

  if (offerErr) {
    return NextResponse.json(
      { error: "Failed to load offers" },
      { status: 500 }
    );
  }

  type OfferWithSeller = OfferRow & {
    seller: { phone: string } | null;
  };
  const rows = (offerData ?? []) as unknown as OfferWithSeller[];

  const isBuyer = demandRow.buyer_id === current.id;

  if (isBuyer) {
    // Buyer sees every offer with full detail + the seller's phone.
    return NextResponse.json({
      counterOfferPrice,
      offers: rows.map((r) => ({
        ...mapOffer(r),
        sellerPhone: r.seller?.phone ?? null,
      })),
    });
  }

  // Seller: split own vs competitor. RLS already hid non-accepted competitors,
  // so any row that isn't the caller's own is an accepted competitor — their
  // price is safe to reveal. Own offer is always full-detail.
  const myOffer = rows.find((r) => r.seller_id === current.id) ?? null;
  const competitors = rows
    .filter((r) => r.seller_id !== current.id)
    .map((r) => ({
      sellerPhone: r.seller?.phone ?? null,
      pricePerUnit:
        typeof r.price_per_unit === "string"
          ? Number(r.price_per_unit)
          : r.price_per_unit,
      // isCounterOfferAccepted is the pure rule; RLS already enforced it, but
      // we re-check here so the response is self-documenting and the unit test
      // of the rule (in shared) matches the route's behavior.
      accepted: isCounterOfferAccepted(
        typeof r.price_per_unit === "string"
          ? Number(r.price_per_unit)
          : r.price_per_unit,
        counterOfferPrice
      ),
    }));

  return NextResponse.json({
    counterOfferPrice,
    myOffer: myOffer ? mapOffer(myOffer) : null,
    competitors,
  });
}
