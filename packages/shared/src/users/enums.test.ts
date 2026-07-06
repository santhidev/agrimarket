import { describe, it, expect } from "vitest";
import { CreditTier, KycStatus, CREDIT_TIERS, KYC_STATUSES } from "./enums";

describe("CreditTier", () => {
  it("exposes the four MVP tiers", () => {
    expect(CreditTier.None).toBe("None");
    expect(CreditTier.Bronze).toBe("Bronze");
    expect(CreditTier.Silver).toBe("Silver");
    expect(CreditTier.Gold).toBe("Gold");
  });

  it("CREDIT_TIERS lists every value", () => {
    expect(CREDIT_TIERS).toEqual(["None", "Bronze", "Silver", "Gold"]);
  });
});

describe("KycStatus", () => {
  it("exposes the four KYC states", () => {
    expect(KycStatus.None).toBe("None");
    expect(KycStatus.Pending).toBe("Pending");
    expect(KycStatus.Approved).toBe("Approved");
    expect(KycStatus.Rejected).toBe("Rejected");
  });

  it("KYC_STATUSES lists every value", () => {
    expect(KYC_STATUSES).toEqual(["None", "Pending", "Approved", "Rejected"]);
  });
});
