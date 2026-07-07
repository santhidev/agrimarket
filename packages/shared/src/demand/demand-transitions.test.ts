import { describe, it, expect } from "vitest";
import { initialPendingQuantity, canEditDemand } from "./demand-transitions";
import { DemandStatus } from "./enums";

describe("initialPendingQuantity", () => {
  it("starts pending_quantity equal to quantity (nothing matched yet)", () => {
    expect(initialPendingQuantity(100)).toBe(100);
  });

  it("carries the value through for any positive quantity", () => {
    expect(initialPendingQuantity(1)).toBe(1);
    expect(initialPendingQuantity(9999)).toBe(9999);
  });
});

describe("canEditDemand", () => {
  it("allows editing while OPEN (owner may update/cancel)", () => {
    expect(canEditDemand(DemandStatus.Open)).toBe(true);
  });

  it("blocks editing once the demand is MATCHED (in flight)", () => {
    expect(canEditDemand(DemandStatus.Matched)).toBe(false);
  });

  it("blocks editing on terminal statuses", () => {
    expect(canEditDemand(DemandStatus.Completed)).toBe(false);
    expect(canEditDemand(DemandStatus.Expired)).toBe(false);
    expect(canEditDemand(DemandStatus.Cancelled)).toBe(false);
  });
});
