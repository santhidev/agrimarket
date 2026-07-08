import { describe, it, expect } from "vitest";
import { computeBestOffers, type BestOfferInputOffer } from "./best-offer";

// Best Offer: Bounded Knapsack (Issue 13).
//
// Given a demand's target quantity + a list of ACTIVE offers (each with
// quantity, price, pickup lat/lng), compute ranked offer combinations: the
// cheapest way(s) to fulfill the demand, with total distance (Haversine,
// weighted by quantity) as the tiebreaker on equal total cost. Whole-offer
// selection (0/1) with overflow trimmed from the most-expensive offer in the
// chosen subset so the combination lands exactly on the target quantity.
// Partial-fulfillment combinations are included only when total supply is
// below the target — otherwise only full combinations are ranked.
//
// This is the most heavily-tested module in the MVP (#13 acceptance). The
// solver is pure: mock numbers are a faithful check. See CONTEXT.md "Best
// Offer" + "Business Rules" (sum(quantity) > 0 และ ≤ demand.quantity).

// Test helper: build an offer with defaults so each case reads its intent.
const offer = (o: Partial<BestOfferInputOffer> & Pick<BestOfferInputOffer, "id">): BestOfferInputOffer => ({
  pricePerUnit: 20,
  quantity: 50,
  pickupLat: 13.75,
  pickupLng: 100.5,
  ...o,
});

const BUYER = { buyerLat: 13.7563, buyerLng: 100.5018 };

describe("computeBestOffers — empty input", () => {
  it("returns no combinations and canFulfill=false when there are no offers", () => {
    const result = computeBestOffers({
      targetQuantity: 100,
      ...BUYER,
      offers: [],
    });
    expect(result.combinations).toEqual([]);
    expect(result.canFulfill).toBe(false);
  });
});

describe("computeBestOffers — single offer", () => {
  it("returns one full combination when one offer exactly meets the target", () => {
    const result = computeBestOffers({
      targetQuantity: 100,
      ...BUYER,
      offers: [
        offer({ id: "a", pricePerUnit: 20, quantity: 100, pickupLat: 13.76, pickupLng: 100.5 }),
      ],
    });
    expect(result.canFulfill).toBe(true);
    expect(result.combinations).toHaveLength(1);

    const combo = result.combinations[0];
    expect(combo.isPartial).toBe(false);
    expect(combo.totalQuantity).toBe(100);
    expect(combo.totalCost).toBe(20 * 100); // price × Q
    expect(combo.offers).toHaveLength(1);
    expect(combo.offers[0]).toMatchObject({
      offerId: "a",
      quantity: 100,
      pricePerUnit: 20,
      lineTotal: 2000,
    });
  });

  it("returns one partial combination + canFulfill=false when supply < target", () => {
    const result = computeBestOffers({
      targetQuantity: 100,
      ...BUYER,
      offers: [
        offer({ id: "a", pricePerUnit: 20, quantity: 30, pickupLat: 13.76, pickupLng: 100.5 }),
      ],
    });
    expect(result.canFulfill).toBe(false);
    expect(result.combinations).toHaveLength(1);

    const combo = result.combinations[0];
    expect(combo.isPartial).toBe(true);
    expect(combo.totalQuantity).toBe(30);
    expect(combo.totalCost).toBe(20 * 30);
    expect(combo.offers[0]).toMatchObject({ offerId: "a", quantity: 30 });
  });
});

describe("computeBestOffers — ranking (cost asc)", () => {
  it("ranks the cheaper full combination first when two offers each fulfill", () => {
    const result = computeBestOffers({
      targetQuantity: 50,
      ...BUYER,
      offers: [
        offer({ id: "cheap", pricePerUnit: 18, quantity: 50, pickupLat: 13.76, pickupLng: 100.5 }),
        offer({ id: "pricey", pricePerUnit: 25, quantity: 50, pickupLat: 13.76, pickupLng: 100.5 }),
      ],
    });
    expect(result.canFulfill).toBe(true);
    // Top combination is the cheaper single-offer combo.
    expect(result.combinations[0].offers[0].offerId).toBe("cheap");
    expect(result.combinations[0].totalCost).toBe(18 * 50);
    // The pricier single-offer combo ranks below it.
    expect(result.combinations[1].offers[0].offerId).toBe("pricey");
  });

  it("breaks equal-cost ties by smaller total distance", () => {
    // Two offers at the same price; one is closer to the buyer.
    const result = computeBestOffers({
      targetQuantity: 50,
      ...BUYER,
      offers: [
        offer({ id: "far", pricePerUnit: 20, quantity: 50, pickupLat: 14.76, pickupLng: 100.5 }), // ~111 km
        offer({ id: "near", pricePerUnit: 20, quantity: 50, pickupLat: 13.80, pickupLng: 100.5 }), // ~5 km
      ],
    });
    expect(result.combinations[0].offers[0].offerId).toBe("near");
    expect(result.combinations[0].totalCost).toBe(result.combinations[1].totalCost);
    expect(result.combinations[0].totalDistanceKm).toBeLessThan(
      result.combinations[1].totalDistanceKm
    );
  });
});

describe("computeBestOffers — overflow trim", () => {
  it("trims a single offer down to the target when its quantity exceeds Q", () => {
    const result = computeBestOffers({
      targetQuantity: 100,
      ...BUYER,
      offers: [
        offer({ id: "big", pricePerUnit: 20, quantity: 150, pickupLat: 13.76, pickupLng: 100.5 }),
      ],
    });
    expect(result.canFulfill).toBe(true);
    const combo = result.combinations[0];
    expect(combo.isPartial).toBe(false);
    expect(combo.totalQuantity).toBe(100);
    expect(combo.offers[0].quantity).toBe(100); // trimmed, not 150
    expect(combo.totalCost).toBe(20 * 100);
  });

  it("trims overflow from the most-expensive offer in a multi-offer subset", () => {
    // {cheap q=30, expensive q=80} = 110, target 100 → trim 10 from expensive.
    const result = computeBestOffers({
      targetQuantity: 100,
      ...BUYER,
      offers: [
        offer({ id: "cheap", pricePerUnit: 15, quantity: 30, pickupLat: 13.76, pickupLng: 100.5 }),
        offer({ id: "expensive", pricePerUnit: 30, quantity: 80, pickupLat: 13.76, pickupLng: 100.5 }),
      ],
    });
    // The best full combination is {cheap 30, expensive 70}: trim 10 off the
    // expensive offer, not the cheap one.
    const best = result.combinations[0];
    expect(best.isPartial).toBe(false);
    expect(best.totalQuantity).toBe(100);
    const cheapLine = best.offers.find((l) => l.offerId === "cheap");
    const expensiveLine = best.offers.find((l) => l.offerId === "expensive");
    expect(cheapLine?.quantity).toBe(30); // untouched
    expect(expensiveLine?.quantity).toBe(70); // trimmed from 80
    expect(best.totalCost).toBe(15 * 30 + 30 * 70); // 450 + 2100
  });
});

describe("computeBestOffers — top-5 cap + partial suppression", () => {
  it("caps the result at 5 combinations, sorted cheapest-first", () => {
    // 6 distinct-price offers, each alone fulfills the target → 6 full combos.
    const offers: BestOfferInputOffer[] = [10, 11, 12, 13, 14, 15].map((p, i) =>
      offer({ id: String.fromCharCode(97 + i), pricePerUnit: p, quantity: 50 })
    );
    const result = computeBestOffers({
      targetQuantity: 50,
      ...BUYER,
      offers,
    });
    expect(result.combinations.length).toBe(5);
    // Sorted ascending by cost (pricePerUnit × 50).
    expect(result.combinations[0].offers[0].pricePerUnit).toBe(10);
    expect(result.combinations[4].offers[0].pricePerUnit).toBe(14);
  });

  it("does not surface partial combinations when total supply can fulfill the target", () => {
    // Two offers each smaller than Q, but together they fulfill it. The
    // single-offer subsets are partial, but supply (60) ≥ Q (50), so those
    // partials must NOT appear — only full combinations rank.
    const result = computeBestOffers({
      targetQuantity: 50,
      ...BUYER,
      offers: [
        offer({ id: "a", pricePerUnit: 20, quantity: 30 }),
        offer({ id: "b", pricePerUnit: 22, quantity: 30 }),
      ],
    });
    expect(result.canFulfill).toBe(true);
    // Every returned combination is full (totalQuantity === 50).
    for (const c of result.combinations) {
      expect(c.isPartial).toBe(false);
      expect(c.totalQuantity).toBe(50);
    }
  });

  it("surfaces partial combinations when total supply is below the target", () => {
    // Two offers, combined < Q — no full combo exists; the best partials rank.
    const result = computeBestOffers({
      targetQuantity: 100,
      ...BUYER,
      offers: [
        offer({ id: "a", pricePerUnit: 20, quantity: 30 }),
        offer({ id: "b", pricePerUnit: 25, quantity: 30 }),
      ],
    });
    expect(result.canFulfill).toBe(false);
    expect(result.combinations.length).toBeGreaterThan(0);
    for (const c of result.combinations) {
      expect(c.isPartial).toBe(true);
    }
  });
});
