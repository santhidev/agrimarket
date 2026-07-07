import { describe, it, expect } from "vitest";
import {
  initialPendingQuantity,
  canEditDemand,
  acceptsOffers,
  isDeadlineExtension,
} from "./demand-transitions";
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

// acceptsOffers (Issue 08): a cancelled/completed/expired demand must not
// accept new offers. Only OPEN does. MATCHED is fully covered so it also
// rejects — #10's offer-create route uses this as the demand-side gate before
// checking seller/KYC uniqueness.
describe("acceptsOffers", () => {
  it("accepts offers while OPEN (the marketplace window)", () => {
    expect(acceptsOffers(DemandStatus.Open)).toBe(true);
  });

  it("rejects new offers once CANCELLED (Issue 08 acceptance)", () => {
    expect(acceptsOffers(DemandStatus.Cancelled)).toBe(false);
  });

  it("rejects new offers once MATCHED (fully covered)", () => {
    expect(acceptsOffers(DemandStatus.Matched)).toBe(false);
  });

  it("rejects new offers on terminal statuses", () => {
    expect(acceptsOffers(DemandStatus.Completed)).toBe(false);
    expect(acceptsOffers(DemandStatus.Expired)).toBe(false);
  });
});

// isDeadlineExtension (Issue 08): PATCH /api/demands/:id must refuse a new
// deadline that isn't strictly later than the current one — otherwise the
// buyer could "extend" by shortening the window (or no-op). Equality is also
// refused (not an extension). Malformed timestamps parse to NaN and refuse.
describe("isDeadlineExtension", () => {
  it("is true when the new deadline is strictly later", () => {
    expect(
      isDeadlineExtension(
        "2026-07-07T00:00:00.000Z",
        "2026-07-08T00:00:00.000Z"
      )
    ).toBe(true);
  });

  it("is false when the new deadline equals the current one (no-op)", () => {
    const same = "2026-07-08T00:00:00.000Z";
    expect(isDeadlineExtension(same, same)).toBe(false);
  });

  it("is false when the new deadline is earlier (shortening)", () => {
    expect(
      isDeadlineExtension(
        "2026-07-08T00:00:00.000Z",
        "2026-07-07T00:00:00.000Z"
      )
    ).toBe(false);
  });

  it("is false when either timestamp is malformed", () => {
    expect(
      isDeadlineExtension("not-a-date", "2026-07-08T00:00:00.000Z")
    ).toBe(false);
    expect(
      isDeadlineExtension("2026-07-08T00:00:00.000Z", "not-a-date")
    ).toBe(false);
  });
});
