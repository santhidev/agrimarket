import { describe, it, expect } from "vitest";
import { profileSchema, requestOtpSchema, verifyOtpSchema } from "./schemas";

describe("requestOtpSchema", () => {
  it("accepts a valid Thai mobile", () => {
    expect(requestOtpSchema.safeParse({ phone: "0812345678" }).success).toBe(true);
  });

  it("rejects a non-Thai number", () => {
    expect(requestOtpSchema.safeParse({ phone: "12345" }).success).toBe(false);
  });
});

describe("verifyOtpSchema", () => {
  it("accepts phone + 6-digit code", () => {
    expect(
      verifyOtpSchema.safeParse({ phone: "0812345678", code: "000000" }).success
    ).toBe(true);
  });

  it("rejects a 5-digit code", () => {
    expect(
      verifyOtpSchema.safeParse({ phone: "0812345678", code: "00000" }).success
    ).toBe(false);
  });
});

describe("profileSchema", () => {
  const valid = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    phone: "0812345678",
    tier: "None",
    kycStatus: "None",
    buyerScore: 0,
    sellerScore: 0,
    isAdmin: false,
  };

  it("accepts a well-shaped profile", () => {
    expect(profileSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all four tiers", () => {
    for (const tier of ["None", "Bronze", "Silver", "Gold"]) {
      expect(profileSchema.safeParse({ ...valid, tier }).success).toBe(true);
    }
  });

  it("rejects an unknown tier", () => {
    expect(profileSchema.safeParse({ ...valid, tier: "Platinum" }).success).toBe(false);
  });

  it("rejects an unknown kycStatus", () => {
    expect(
      profileSchema.safeParse({ ...valid, kycStatus: "Waiting" }).success
    ).toBe(false);
  });

  it("rejects a negative score", () => {
    expect(
      profileSchema.safeParse({ ...valid, buyerScore: -1 }).success
    ).toBe(false);
  });

  it("rejects a non-UUID id", () => {
    expect(profileSchema.safeParse({ ...valid, id: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects an invalid phone", () => {
    expect(profileSchema.safeParse({ ...valid, phone: "abc" }).success).toBe(false);
  });

  it("rejects a missing field", () => {
    const { isAdmin: _omit, ...rest } = valid;
    expect(profileSchema.safeParse(rest).success).toBe(false);
  });
});
