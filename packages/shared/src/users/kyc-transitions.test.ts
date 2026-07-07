import { describe, it, expect } from "vitest";
import { canSubmitKyc, nextKycStatus } from "./kyc-transitions";
import { KycStatus } from "./enums";

describe("canSubmitKyc", () => {
  it("allows submitting from None (fresh user)", () => {
    expect(canSubmitKyc(KycStatus.None)).toBe(true);
  });

  it("allows resubmitting after a rejection", () => {
    expect(canSubmitKyc(KycStatus.Rejected)).toBe(true);
  });

  it("blocks submitting while a submission is Pending", () => {
    expect(canSubmitKyc(KycStatus.Pending)).toBe(false);
  });

  it("blocks submitting once already Approved (terminal)", () => {
    expect(canSubmitKyc(KycStatus.Approved)).toBe(false);
  });
});

describe("nextKycStatus", () => {
  describe("submit", () => {
    it("None → Pending", () => {
      expect(nextKycStatus(KycStatus.None, "submit")).toBe(KycStatus.Pending);
    });

    it("Rejected → Pending (resubmit after rejection)", () => {
      expect(nextKycStatus(KycStatus.Rejected, "submit")).toBe(KycStatus.Pending);
    });

    it("rejects a second submission while Pending", () => {
      expect(nextKycStatus(KycStatus.Pending, "submit")).toBeNull();
    });

    it("rejects a submission once Approved", () => {
      expect(nextKycStatus(KycStatus.Approved, "submit")).toBeNull();
    });
  });

  describe("approve", () => {
    it("Pending → Approved (the happy path)", () => {
      expect(nextKycStatus(KycStatus.Pending, "approve")).toBe(KycStatus.Approved);
    });

    it("rejects approving a non-pending user (already resolved)", () => {
      expect(nextKycStatus(KycStatus.Approved, "approve")).toBeNull();
      expect(nextKycStatus(KycStatus.Rejected, "approve")).toBeNull();
      expect(nextKycStatus(KycStatus.None, "approve")).toBeNull();
    });
  });

  describe("reject", () => {
    it("Pending → Rejected", () => {
      expect(nextKycStatus(KycStatus.Pending, "reject")).toBe(KycStatus.Rejected);
    });

    it("rejects rejecting a non-pending user", () => {
      expect(nextKycStatus(KycStatus.Approved, "reject")).toBeNull();
      expect(nextKycStatus(KycStatus.Rejected, "reject")).toBeNull();
      expect(nextKycStatus(KycStatus.None, "reject")).toBeNull();
    });
  });

  describe("acceptance-criteria lifecycles", () => {
    it("None → Pending → Approved", () => {
      let s: KycStatus = KycStatus.None;
      s = nextKycStatus(s, "submit")!;
      expect(s).toBe(KycStatus.Pending);
      s = nextKycStatus(s, "approve")!;
      expect(s).toBe(KycStatus.Approved);
    });

    it("None → Pending → Rejected → Pending → Approved (resubmit after reject)", () => {
      let s: KycStatus = KycStatus.None;
      s = nextKycStatus(s, "submit")!;
      s = nextKycStatus(s, "reject")!;
      s = nextKycStatus(s, "submit")!;
      s = nextKycStatus(s, "approve")!;
      expect(s).toBe(KycStatus.Approved);
    });
  });
});
