import { describe, it, expect } from "vitest";
import { requestOtpSchema, verifyOtpSchema } from "@agrimarket/shared";

describe("requestOtpSchema", () => {
  it("accepts a valid 9-digit mobile", () => {
    expect(requestOtpSchema.safeParse({ phone: "0812345678" }).success).toBe(true);
  });

  it("accepts an 8-digit landline", () => {
    expect(requestOtpSchema.safeParse({ phone: "021234567" }).success).toBe(true);
  });

  it("rejects a phone without leading 0", () => {
    expect(requestOtpSchema.safeParse({ phone: "812345678" }).success).toBe(false);
  });

  it("rejects a too-short phone", () => {
    expect(requestOtpSchema.safeParse({ phone: "01234" }).success).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(requestOtpSchema.safeParse({ phone: "0abcdef" }).success).toBe(false);
  });
});

describe("verifyOtpSchema", () => {
  it("accepts phone + 6-digit code", () => {
    expect(
      verifyOtpSchema.safeParse({ phone: "0812345678", code: "000000" }).success
    ).toBe(true);
  });

  it("accepts an optional fcmToken", () => {
    expect(
      verifyOtpSchema.safeParse({
        phone: "0812345678",
        code: "000000",
        fcmToken: "abc",
      }).success
    ).toBe(true);
  });

  it("rejects a 5-digit code", () => {
    expect(
      verifyOtpSchema.safeParse({ phone: "0812345678", code: "00000" }).success
    ).toBe(false);
  });

  it("rejects a non-numeric code", () => {
    expect(
      verifyOtpSchema.safeParse({ phone: "0812345678", code: "abcdef" }).success
    ).toBe(false);
  });
});
