import { OfferStatus } from "./enums";

// Pure offer lifecycle helpers (Issue 08).
//
// Issue 08 needs the offer vocabulary to express the demand-cancel cascade
// ("every non-terminal offer → CANCELLED") and the demand-rejects-new-offers
// gate, even though the offers TABLE lands in Issue 10. These predicates are
// pure: the routes apply them; RLS/DB enforcement is the route's job. The MVP
// Offer state machine is ACTIVE → PENDING_SELLER_CONFIRMATION → CONFIRMED →
// MATCHED (self-pickup), with WITHDRAWN/REJECTED/EXPIRED/CANCELLED/DECLINED as
// terminal exits (see CONTEXT.md "State Machines").

// --- Is an offer terminal? --------------------------------------------------

/// Terminal offer statuses never move again — MATCHED, WITHDRAWN, REJECTED,
/// EXPIRED, CANCELLED, DECLINED. A demand cancel cascades only to non-terminal
/// offers; a terminal offer is left as-is (it already reached its end state).
export function isOfferTerminal(status: OfferStatus): boolean {
  return (
    status === OfferStatus.Matched ||
    status === OfferStatus.Withdrawn ||
    status === OfferStatus.Rejected ||
    status === OfferStatus.Expired ||
    status === OfferStatus.Cancelled ||
    status === OfferStatus.Declined
  );
}

// --- Should this offer be CANCELLED when the demand is cancelled? -----------

/// The Issue 08 cascade rule: when a Demand is CANCELLED, every ACTIVE,
/// PENDING_SELLER_CONFIRMATION, or CONFIRMED offer flips to CANCELLED too.
/// Terminal offers (MATCHED/WITHDRAWN/REJECTED/EXPIRED/CANCELLED/DECLINED) are
/// untouched — they already ended. Active/Confirmed offers are in-flight and
/// must be released; Pending ones are mid-handshake and released too.
export function shouldCancelOfferOnDemandCancel(status: OfferStatus): boolean {
  return (
    status === OfferStatus.Active ||
    status === OfferStatus.PendingSellerConfirmation ||
    status === OfferStatus.Confirmed
  );
}

// --- Can the seller still edit this offer? (Issue 10) -----------------------

/// True only for ACTIVE. Once the buyer selects (PENDING_SELLER_CONFIRMATION)
/// the terms are locked — the seller can't shift price/quantity under a buyer
/// who just chose them. CONFIRMED and terminal statuses are obviously locked.
/// Issue 10's PATCH route gates on this before touching any field.
export function canEditOffer(status: OfferStatus): boolean {
  return status === OfferStatus.Active;
}

// --- Can the seller withdraw this offer? (Issue 10) -------------------------

/// True for ACTIVE, PENDING_SELLER_CONFIRMATION, and CONFIRMED — the seller
/// can still pull out of the running before the deal locks. MATCHED is locked
/// (the deal is done; withdrawal would break a matched transaction). Terminal
/// statuses can't withdraw (WITHDRAWN is already withdrawn, etc.). Issue 10's
/// DELETE route gates on this before flipping to WITHDRAWN.
export function canWithdrawOffer(status: OfferStatus): boolean {
  return (
    status === OfferStatus.Active ||
    status === OfferStatus.PendingSellerConfirmation ||
    status === OfferStatus.Confirmed
  );
}

// --- Buyer select / seller confirm-decline gates (Issue 14) -----------------
//
// The select → confirm handshake: the buyer picks a combination of offers
// (POST /api/demands/:id/select), pushing them to PENDING_SELLER_CONFIRMATION
// and setting accepted_quantity; each chosen seller then confirms
// (POST /api/offers/:id/confirm-sale → CONFIRMED) or declines (decline-sale →
// DECLINED). If the buyer re-selects after a decline, every PENDING and
// CONFIRMED offer on the demand reverts to ACTIVE so the new selection starts
// clean — the buyer picks a fresh set and every chosen offer must be
// re-confirmed (CONTEXT.md "วนกลับเลือกให้ → CONFIRMED offers ต้องเลือกใหม่ +
// ยืนยันใหม่"). REJECTED is reserved for #15 (match lock: non-matched offers
// flip to REJECTED); #14 never sets REJECTED.

/// True only for ACTIVE — the buyer may select an offer that's still freely
/// competing. PENDING/CONFIRMED must reset to ACTIVE first (the route does
/// this on re-select); terminal statuses are out of the running. The route
/// allows selecting an offer that's currently PENDING/CONFIRMED because it
/// resets before applying the new selection — this predicate answers
/// "selectable in principle", the reset is the route's concern.
export function canBeSelected(status: OfferStatus): boolean {
  return status === OfferStatus.Active;
}

/// True only for PENDING_SELLER_CONFIRMATION — the seller may confirm a sale
/// only for an offer the buyer just selected. ACTIVE has no selection to
/// respond to; CONFIRMED already said yes; terminal/DECLINED are closed.
export function canSellerConfirm(status: OfferStatus): boolean {
  return status === OfferStatus.PendingSellerConfirmation;
}

/// True only for PENDING_SELLER_CONFIRMATION — the seller may decline a sale
/// only for an offer the buyer just selected. Symmetric with canSellerConfirm.
export function canSellerDecline(status: OfferStatus): boolean {
  return status === OfferStatus.PendingSellerConfirmation;
}

/// True for PENDING_SELLER_CONFIRMATION and CONFIRMED — these are the offers
/// that must revert to ACTIVE when the buyer re-selects. ACTIVE stays ACTIVE;
/// terminal statuses are left as-is. Used by the select route's reset step.
export function shouldResetOnReselect(status: OfferStatus): boolean {
  return (
    status === OfferStatus.PendingSellerConfirmation ||
    status === OfferStatus.Confirmed
  );
}

// --- Match lock (Issue 15) --------------------------------------------------
//
// Once every chosen seller has confirmed (all selected offers are CONFIRMED),
// the buyer locks the deal via POST /api/demands/:id/match → Demand MATCHED +
// the selected offers MATCHED (self-pickup: the system hands the buyer the
// sellers' phone numbers, no in-app payment). The two predicates below are the
// match precondition and the match-lock cascade:
//   - allSelectedOffersConfirmed: the buyer may only match when there is at
//     least one chosen offer and every chosen offer is CONFIRMED (no seller
//     still pending). ACTIVE-only or empty demand → nothing to lock.
//   - shouldRejectOnMatch: when the deal locks, the remaining chosen offers
//     (still PENDING_SELLER_CONFIRMATION or CONFIRMED but not in the matched
//     selection) drop out of the running and flip to REJECTED. CONTEXT.md
//     reserves REJECTED for exactly this; #14 never sets it. ACTIVE offers are
//     left as-is (a MATCHED demand stops accepting offers, so they wither —
//     they are not force-rejected).

/// Match precondition: there is at least one chosen offer (PENDING_SELLER_
/// CONFIRMATION or CONFIRMED) and none of them is still PENDING_SELLER_
/// CONFIRMATION — i.e. every seller the buyer is waiting on has said yes.
/// Offers with no selection (ACTIVE, MATCHED, terminal) are ignored; an empty
/// list or a list with only ACTIVE offers returns false (nothing to lock).
export function allSelectedOffersConfirmed(
  offers: { status: string }[]
): boolean {
  const chosen = offers.filter(
    (o) =>
      o.status === OfferStatus.PendingSellerConfirmation ||
      o.status === OfferStatus.Confirmed
  );
  if (chosen.length === 0) return false;
  return chosen.every(
    (o) => o.status === OfferStatus.Confirmed
  );
}

/// True for PENDING_SELLER_CONFIRMATION and CONFIRMED — the in-handshake
/// statuses that must drop out of the running (→ REJECTED) when a competing
/// selection locks the deal. ACTIVE offers keep competing (a MATCHED demand
/// stops accepting offers, but the seller isn't rejected — they just didn't
/// win this time); terminal statuses are left as-is (they already ended).
/// Symmetric with shouldResetOnReselect but on the match path instead of the
/// re-select path.
export function shouldRejectOnMatch(status: OfferStatus): boolean {
  return (
    status === OfferStatus.PendingSellerConfirmation ||
    status === OfferStatus.Confirmed
  );
}
