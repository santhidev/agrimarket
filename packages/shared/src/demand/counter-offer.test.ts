import { describe, it, expect } from "vitest";
import { isCounterOfferAccepted } from "./counter-offer";

// Counter-offer acceptance threshold (Issues 11 + 12).
//
// A buyer sends a counter-offer (desired price) to a demand (#12); sellers
// respond by editing their own offer price down. A seller whose offer price is
// ≤ the counter-offer price is "accepted" — their price becomes visible to
// competing sellers in the competitive bidding view (#11). Before any
// counter-offer exists, no seller is accepted (competitor prices stay hidden).
// This predicate is pure: a test with mock numbers is a faithful check.

describe("isCounterOfferAccepted", () => {
  it("returns false when no counter-offer has been set yet", () => {
    expect(isCounterOfferAccepted(20, null)).toBe(false);
  });

  it("returns true when the offer price equals the counter-offer (tie accepted)", () => {
    expect(isCounterOfferAccepted(20, 20)).toBe(true);
  });

  it("returns true when the offer price is below the counter-offer", () => {
    expect(isCounterOfferAccepted(18, 20)).toBe(true);
  });

  it("returns false when the offer price is above the counter-offer", () => {
    expect(isCounterOfferAccepted(22, 20)).toBe(false);
  });

  it("uses the offer's own price, not a competitor's (each offer checked independently)", () => {
    // Seller A at 18 (accepted), Seller B at 25 (not) against the same 20.
    expect(isCounterOfferAccepted(18, 20)).toBe(true);
    expect(isCounterOfferAccepted(25, 20)).toBe(false);
  });
});
