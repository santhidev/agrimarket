import { describe, it, expect } from "vitest";
import { OfferStatus } from "./enums";
import {
  isOfferTerminal,
  shouldCancelOfferOnDemandCancel,
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
