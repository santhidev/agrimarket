import { describe, it, expect } from "vitest";
import { OfferStatus } from "./enums";
import {
  isOfferTerminal,
  shouldCancelOfferOnDemandCancel,
  canEditOffer,
  canWithdrawOffer,
} from "./offer-transitions";

// Pure offer lifecycle helpers (Issue 08).
//
// Issue 08 needs the offer vocabulary to express the demand-cancel cascade
// ("every non-terminal offer → CANCELLED") and the demand-rejects-new-offers
// gate, even though the offers TABLE is Issue 10. These predicates are pure: a
// test with mock statuses is a faithful check — RLS/DB enforcement is the
// route's job, not the helper's.

describe("isOfferTerminal", () => {
  it("marks MATCHED as terminal (the deal is locked)", () => {
    expect(isOfferTerminal(OfferStatus.Matched)).toBe(true);
  });

  it("marks every seller/buyer exit as terminal", () => {
    expect(isOfferTerminal(OfferStatus.Withdrawn)).toBe(true);
    expect(isOfferTerminal(OfferStatus.Rejected)).toBe(true);
    expect(isOfferTerminal(OfferStatus.Expired)).toBe(true);
    expect(isOfferTerminal(OfferStatus.Cancelled)).toBe(true);
    expect(isOfferTerminal(OfferStatus.Declined)).toBe(true);
  });

  it("leaves in-flight statuses as non-terminal", () => {
    expect(isOfferTerminal(OfferStatus.Active)).toBe(false);
    expect(isOfferTerminal(OfferStatus.PendingSellerConfirmation)).toBe(false);
    expect(isOfferTerminal(OfferStatus.Confirmed)).toBe(false);
  });
});

describe("shouldCancelOfferOnDemandCancel", () => {
  it("cancels ACTIVE offers (seller still in the running)", () => {
    expect(shouldCancelOfferOnDemandCancel(OfferStatus.Active)).toBe(true);
  });

  it("cancels PENDING_SELLER_CONFIRMATION offers (mid-handshake)", () => {
    expect(
      shouldCancelOfferOnDemandCancel(OfferStatus.PendingSellerConfirmation)
    ).toBe(true);
  });

  it("cancels CONFIRMED offers (seller said yes, deal not locked)", () => {
    expect(shouldCancelOfferOnDemandCancel(OfferStatus.Confirmed)).toBe(true);
  });

  it("leaves MATCHED offers untouched (the deal is locked)", () => {
    expect(shouldCancelOfferOnDemandCancel(OfferStatus.Matched)).toBe(false);
  });

  it("leaves already-ended offers untouched", () => {
    expect(shouldCancelOfferOnDemandCancel(OfferStatus.Withdrawn)).toBe(false);
    expect(shouldCancelOfferOnDemandCancel(OfferStatus.Rejected)).toBe(false);
    expect(shouldCancelOfferOnDemandCancel(OfferStatus.Expired)).toBe(false);
    expect(shouldCancelOfferOnDemandCancel(OfferStatus.Cancelled)).toBe(false);
    expect(shouldCancelOfferOnDemandCancel(OfferStatus.Declined)).toBe(false);
  });
});

// canEditOffer (Issue 10): a seller may edit price/quantity/grade/location/
// ready_date/photos only while the offer is ACTIVE. Once the buyer selects
// (PENDING_SELLER_CONFIRMATION) or the seller confirms (CONFIRMED) or the
// offer reaches any terminal state, fields are locked — the handshake is
// underway or finished and the terms can't shift under the other party.
describe("canEditOffer", () => {
  it("allows editing while ACTIVE (seller can still adjust terms)", () => {
    expect(canEditOffer(OfferStatus.Active)).toBe(true);
  });

  it("blocks editing once the buyer has selected (handshake started)", () => {
    expect(canEditOffer(OfferStatus.PendingSellerConfirmation)).toBe(false);
  });

  it("blocks editing on CONFIRMED (seller accepted the selection)", () => {
    expect(canEditOffer(OfferStatus.Confirmed)).toBe(false);
  });

  it("blocks editing on every terminal status", () => {
    expect(canEditOffer(OfferStatus.Matched)).toBe(false);
    expect(canEditOffer(OfferStatus.Withdrawn)).toBe(false);
    expect(canEditOffer(OfferStatus.Rejected)).toBe(false);
    expect(canEditOffer(OfferStatus.Expired)).toBe(false);
    expect(canEditOffer(OfferStatus.Cancelled)).toBe(false);
    expect(canEditOffer(OfferStatus.Declined)).toBe(false);
  });
});

// canWithdrawOffer (Issue 10): a seller may withdraw an offer while it is still
// in-flight (ACTIVE / PENDING_SELLER_CONFIRMATION / CONFIRMED) — they can pull
// out of the running before the deal locks. MATCHED is locked (the deal is
// done; withdrawal would break a matched transaction). Terminal statuses can't
// withdraw (they already ended — WITHDRAWN is already withdrawn, etc.).
describe("canWithdrawOffer", () => {
  it("allows withdrawing an ACTIVE offer", () => {
    expect(canWithdrawOffer(OfferStatus.Active)).toBe(true);
  });

  it("allows withdrawing a PENDING_SELLER_CONFIRMATION offer", () => {
    expect(canWithdrawOffer(OfferStatus.PendingSellerConfirmation)).toBe(true);
  });

  it("allows withdrawing a CONFIRMED offer", () => {
    expect(canWithdrawOffer(OfferStatus.Confirmed)).toBe(true);
  });

  it("blocks withdrawing a MATCHED offer (the deal is locked)", () => {
    expect(canWithdrawOffer(OfferStatus.Matched)).toBe(false);
  });

  it("blocks withdrawing already-terminal offers", () => {
    expect(canWithdrawOffer(OfferStatus.Withdrawn)).toBe(false);
    expect(canWithdrawOffer(OfferStatus.Rejected)).toBe(false);
    expect(canWithdrawOffer(OfferStatus.Expired)).toBe(false);
    expect(canWithdrawOffer(OfferStatus.Cancelled)).toBe(false);
    expect(canWithdrawOffer(OfferStatus.Declined)).toBe(false);
  });
});
