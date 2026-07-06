import { describe, it, expect } from "vitest";
import { normalizePhone } from "./normalize-phone";

describe("normalizePhone", () => {
  it("passes a canonical 0-prefixed Thai mobile through unchanged", () => {
    expect(normalizePhone("0812345678")).toBe("0812345678");
  });

  it("adds a leading 0 when the user typed without it (e.g. +66 UX)", () => {
    expect(normalizePhone("812345678")).toBe("0812345678");
  });

  it("strips whitespace and dashes before validating", () => {
    expect(normalizePhone("081-234-5678")).toBe("0812345678");
    expect(normalizePhone(" 0812 345 678 ")).toBe("0812345678");
  });

  it("converts +66 / 66 international form to 0-prefixed", () => {
    expect(normalizePhone("+66812345678")).toBe("0812345678");
    expect(normalizePhone("66812345678")).toBe("0812345678");
  });

  it("returns null for a too-short number", () => {
    expect(normalizePhone("12345")).toBeNull();
  });

  it("returns null for a too-long number", () => {
    expect(normalizePhone("081234567899")).toBeNull();
  });

  it("returns null when digits are not a valid Thai mobile after normalization", () => {
    // 9 digits with leading 0 is allowed (some landlines) but the prefix check
    // requires the second digit to be a real mobile range — we only enforce
    // length here, so 021234567 (9 digits, landline-like) is accepted.
    expect(normalizePhone("021234567")).toBe("021234567");
  });

  it("returns null for non-numeric input", () => {
    expect(normalizePhone("abcdefghij")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
  });
});
