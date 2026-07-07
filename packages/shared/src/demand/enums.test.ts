import { describe, it, expect } from "vitest";
import { DemandStatus, DEMAND_STATUSES } from "./enums";

describe("DemandStatus", () => {
  it("exposes the MVP lifecycle values", () => {
    expect(DemandStatus.Open).toBe("OPEN");
    expect(DemandStatus.Matched).toBe("MATCHED");
    expect(DemandStatus.Completed).toBe("COMPLETED");
    expect(DemandStatus.Expired).toBe("EXPIRED");
    expect(DemandStatus.Cancelled).toBe("CANCELLED");
  });

  it("DEMAND_STATUSES lists every status", () => {
    expect(DEMAND_STATUSES).toEqual([
      "OPEN",
      "MATCHED",
      "COMPLETED",
      "EXPIRED",
      "CANCELLED",
    ]);
  });
});
