import { describe, it, expect } from "vitest";
import {
  computeFulfillmentRate,
  computeTransactionSuccess,
  computeRepeatRate,
  type DemandCounts,
} from "./metrics";

const all: DemandCounts = {
  open: 10,
  matched: 5,
  completed: 12,
  expired: 6,
  cancelled: 8,
}; // total = 41, terminal success = 17, terminal total = 31

describe("computeFulfillmentRate", () => {
  it("returns (matched + completed) / total when total > 0", () => {
    // (5 + 12) / 41
    expect(computeFulfillmentRate(all)).toBeCloseTo(17 / 41, 10);
  });

  it("returns 0 when every count is 0 (no demands)", () => {
    const empty: DemandCounts = {
      open: 0,
      matched: 0,
      completed: 0,
      expired: 0,
      cancelled: 0,
    };
    expect(computeFulfillmentRate(empty)).toBe(0);
  });

  it("is 0 when matched + completed are 0 but total is non-zero", () => {
    expect(computeFulfillmentRate({ ...all, matched: 0, completed: 0 })).toBe(0);
  });

  it("is 1 when every demand is matched or completed", () => {
    expect(
      computeFulfillmentRate({
        open: 0,
        matched: 3,
        completed: 7,
        expired: 0,
        cancelled: 0,
      })
    ).toBe(1);
  });

  it("treats negative counts as 0 (defensive, never negative)", () => {
    // negative matched shouldn't push the rate below 0
    const neg: DemandCounts = {
      open: 10,
      matched: -5,
      completed: 5,
      expired: 1,
      cancelled: 1,
    };
    expect(computeFulfillmentRate(neg)).toBeGreaterThanOrEqual(0);
    expect(computeFulfillmentRate(neg)).toBeLessThanOrEqual(1);
  });
});

describe("computeTransactionSuccess", () => {
  it("returns (matched + completed) / (matched + completed + expired + cancelled)", () => {
    // 17 / (17 + 6 + 8) = 17 / 31
    expect(computeTransactionSuccess(all)).toBeCloseTo(17 / 31, 10);
  });

  it("excludes OPEN from the denominator (unresolved)", () => {
    // open=10 doesn't change it vs all
    const noOpen: DemandCounts = {
      open: 0,
      matched: 5,
      completed: 12,
      expired: 6,
      cancelled: 8,
    };
    expect(computeTransactionSuccess(noOpen)).toBeCloseTo(17 / 31, 10);
  });

  it("returns 0 when no terminal demands exist", () => {
    const onlyOpen: DemandCounts = {
      open: 99,
      matched: 0,
      completed: 0,
      expired: 0,
      cancelled: 0,
    };
    expect(computeTransactionSuccess(onlyOpen)).toBe(0);
  });

  it("is 1 when every terminal demand matched or completed", () => {
    expect(
      computeTransactionSuccess({
        open: 5,
        matched: 2,
        completed: 3,
        expired: 0,
        cancelled: 0,
      })
    ).toBe(1);
  });
});

describe("computeRepeatRate", () => {
  it("returns buyersWith2Plus / totalBuyers", () => {
    expect(computeRepeatRate(10, 3)).toBeCloseTo(0.3, 10);
  });

  it("returns 0 when totalBuyers is 0", () => {
    expect(computeRepeatRate(0, 0)).toBe(0);
  });

  it("is 1 when every buyer has 2+ demands", () => {
    expect(computeRepeatRate(5, 5)).toBe(1);
  });

  it("is 0 when no buyer repeats", () => {
    expect(computeRepeatRate(8, 0)).toBe(0);
  });

  it("clamps negative inputs to a [0,1] rate", () => {
    expect(computeRepeatRate(-1, 0)).toBe(0);
    expect(computeRepeatRate(10, -3)).toBeGreaterThanOrEqual(0);
  });
});
