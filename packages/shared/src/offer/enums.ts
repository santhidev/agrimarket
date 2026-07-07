// Offer lifecycle statuses shared across web + edge functions (Issue 08).
//
// Values are stored as text in public.offers.status (CHECK list) — uppercase,
// matching the demand/kyc convention. The MVP Offer state machine is
// ACTIVE → PENDING_SELLER_CONFIRMATION → CONFIRMED → MATCHED (self-pickup).
// Terminal exits: WITHDRAWN (seller pulls), REJECTED (buyer dismisses on
// select), EXPIRED, CANCELLED (the demand was cancelled — Issue 08 cascade),
// DECLINED (seller didn't confirm in 24h). See CONTEXT.md "State Machines".
//
// Declared now (Issue 08) because the demand-cancel cascade needs the offer
// status vocabulary to express "non-terminal offers → CANCELLED". The offers
// TABLE itself lands in Issue 10; this file is the shared vocabulary both
// issues read from.

/** Offer lifecycle. ACTIVE on create; MATCHED when accepted + confirmed. */
export const OfferStatus = {
  Active: "ACTIVE",
  PendingSellerConfirmation: "PENDING_SELLER_CONFIRMATION",
  Confirmed: "CONFIRMED",
  Matched: "MATCHED",
  Withdrawn: "WITHDRAWN",
  Rejected: "REJECTED",
  Expired: "EXPIRED",
  Cancelled: "CANCELLED",
  Declined: "DECLINED",
} as const;
export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];

export const OFFER_STATUSES = Object.values(OfferStatus);
