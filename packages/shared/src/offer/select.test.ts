import { describe, it, expect } from "vitest";
import { isValidSelectionQuantities } from "./select";

// Buyer select quantity validation (Issue 14).
//
// When the buyer selects a combination of offers, the chosen accepted
// quantities must satisfy CONTEXT.md's "Confirm (select): sum(quantity) > 0
// และ ≤ demand.quantity" + each accepted_quantity ≤ the offer's offered
// quantity + no duplicate offerIds + every acceptedQty > 0. This predicate is
// pure: the route has the offer rows; this answers "is the selection valid
// given those rows + the demand's target quantity".

const item = (offerId: string, acceptedQuantity: number, offerQuantity: number) => ({
  offerId,
  acceptedQuantity,
  offerQuantity,
});

describe("isValidSelectionQuantities", () => {
  it("accepts a selection whose total is within the demand quantity", () => {
    expect(
      isValidSelectionQuantities(
        100,
        [
          item("a", 30, 50),
          item("b", 70, 80),
        ]
      )
    ).toBe(true);
  });

  it("accepts a selection whose total exactly equals the demand quantity", () => {
    expect(
      isValidSelectionQuantities(
        100,
        [item("a", 100, 100)]
      )
    ).toBe(true);
  });

  it("rejects a selection whose total exceeds the demand quantity", () => {
    expect(
      isValidSelectionQuantities(
        100,
        [
          item("a", 60, 60),
          item("b", 50, 50),
        ]
      )
    ).toBe(false);
  });

  it("rejects a selection whose total is zero (nothing selected)", () => {
    expect(
      isValidSelectionQuantities(100, [item("a", 0, 50)])
    ).toBe(false);
  });

  it("rejects an item whose accepted quantity exceeds the offer's offered quantity", () => {
    expect(
      isValidSelectionQuantities(100, [item("a", 60, 50)])
    ).toBe(false);
  });

  it("rejects duplicate offerIds in the selection", () => {
    expect(
      isValidSelectionQuantities(
        100,
        [
          item("a", 30, 50),
          item("a", 40, 50),
        ]
      )
    ).toBe(false);
  });

  it("rejects an empty selection", () => {
    expect(isValidSelectionQuantities(100, [])).toBe(false);
  });

  it("rejects a negative accepted quantity", () => {
    expect(
      isValidSelectionQuantities(100, [item("a", -5, 50)])
    ).toBe(false);
  });
});
