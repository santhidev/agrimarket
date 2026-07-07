// Pure counter-offer helpers (Issues 11 + 12).
//
// A counter-offer is the buyer's desired price for a demand (#12). It does NOT
// change any offer's status — sellers respond by editing their own offer price
// down (reusing PATCH from #10). When a seller's offer price drops to ≤ the
// counter-offer price, they are "accepted": their price becomes visible to
// competing sellers in the competitive bidding view (#11). Before any
// counter-offer exists (null), no seller is accepted.
//
// This predicate is pure: the route applies it per-offer; RLS/DB enforcement
// is the route's job. See CONTEXT.md "Counter-offer" + "Business Rules".

// --- Has this offer "accepted" the current counter-offer? -------------------

/// True when the seller's offer price is at or below the buyer's latest
/// counter-offer price. Equality counts as accepted (the seller matched the
/// buyer's ask exactly). Returns false when no counter-offer has been set
/// (null) — the competitive view hides all competitor prices until the buyer
/// opens negotiation, and re-hides everyone when a buyer raises the ask.
export function isCounterOfferAccepted(
  offerPrice: number,
  counterOfferPrice: number | null
): boolean {
  if (counterOfferPrice === null) return false;
  return offerPrice <= counterOfferPrice;
}
