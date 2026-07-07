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
