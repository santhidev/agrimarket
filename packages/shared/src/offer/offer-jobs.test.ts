import { describe, it, expect } from "vitest";
import { shouldDeclineOffer, DECLINE_AFTER_MS } from "./offer-jobs";
import { OfferStatus } from "./enums";

// shouldDeclineOffer (Issue 15): the recurring auto-decline job finds
// PENDING_SELLER_CONFIRMATION offers that have sat unanswered for ≥ 24h and
// flips them to DECLINED. The route does the coarse filter in SQL; this
// predicate is the pure re-check each candidate row must pass before UPDATE, so
// a race (seller confirmed between SELECT and UPDATE) is skipped and every
// tick stays idempotent. Mirrors shouldCompleteDemand's shape + boundary tests.
describe("shouldDeclineOffer", () => {
  it("declines a PENDING_SELLER_CONFIRMATION offer older than 24h", () => {
    // now is 25h after updatedAt → past the 24h threshold.
    const now = new Date("2026-07-08T13:00:00.000Z");
    expect(
      shouldDeclineOffer(
        {
          status: OfferStatus.PendingSellerConfirmation,
          updatedAt: "2026-07-07T12:00:00.000Z",
        },
        now
      )
    ).toBe(true);
  });

  it("does not decline a PENDING_SELLER_CONFIRMATION offer younger than 24h", () => {
    // 23h after updatedAt — still inside the 24h window.
    const now = new Date("2026-07-08T11:00:00.000Z");
    expect(
      shouldDeclineOffer(
        {
          status: OfferStatus.PendingSellerConfirmation,
          updatedAt: "2026-07-07T12:00:00.000Z",
        },
        now
      )
    ).toBe(false);
  });

  it("declines a PENDING_SELLER_CONFIRMATION offer exactly 24h old (>= boundary)", () => {
    const now = new Date("2026-07-08T12:00:00.000Z");
    expect(
      shouldDeclineOffer(
        {
          status: OfferStatus.PendingSellerConfirmation,
          updatedAt: "2026-07-07T12:00:00.000Z",
        },
        now
      )
    ).toBe(true);
  });

  it("does not decline an offer that already left PENDING_SELLER_CONFIRMATION", () => {
    // A seller confirmed (→ CONFIRMED) or the buyer re-selected (→ ACTIVE)
    // since the SQL pre-filter — either way the offer is no longer in the
    // state the 24h clock applies to. A prior tick's DECLINED is also skipped.
    const now = new Date("2026-07-10T12:00:00.000Z");
    const oldUpdatedAt = "2026-07-01T12:00:00.000Z";
    expect(
      shouldDeclineOffer(
        { status: OfferStatus.Confirmed, updatedAt: oldUpdatedAt },
        now
      )
    ).toBe(false);
    expect(
      shouldDeclineOffer(
        { status: OfferStatus.Active, updatedAt: oldUpdatedAt },
        now
      )
    ).toBe(false);
    expect(
      shouldDeclineOffer(
        { status: OfferStatus.Declined, updatedAt: oldUpdatedAt },
        now
      )
    ).toBe(false);
    expect(
      shouldDeclineOffer(
        { status: OfferStatus.Matched, updatedAt: oldUpdatedAt },
        now
      )
    ).toBe(false);
  });

  it("skips a row with an unparseable updatedAt", () => {
    const now = new Date("2026-07-08T12:00:00.000Z");
    expect(
      shouldDeclineOffer(
        {
          status: OfferStatus.PendingSellerConfirmation,
          updatedAt: "not-a-date",
        },
        now
      )
    ).toBe(false);
  });
});

describe("DECLINE_AFTER_MS", () => {
  it("is exactly 24 hours in milliseconds", () => {
    expect(DECLINE_AFTER_MS).toBe(24 * 60 * 60 * 1000);
  });
});
