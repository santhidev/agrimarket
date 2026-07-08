import { describe, it, expect } from "vitest";
import { followSchema, followedProductSchema } from "./schemas";

// Follow read-shape schemas (Issue 16). The follow/unfollow endpoints take the
// product id from the URL path, so only the read shapes (follow row + the
// followed-product join) are shared. Mirrors the catalog suggestion-schemas
// test pattern: valid parse + uuid rejection + strict-mode extra-key rejection.

describe("followSchema", () => {
  const validFollow = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: "550e8400-e29b-41d4-a716-446655440001",
    productId: "550e8400-e29b-41d4-a716-446655440002",
    createdAt: "2026-07-08T14:00:00.000Z",
  };

  it("accepts a valid follow row", () => {
    expect(followSchema.safeParse(validFollow).success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    expect(
      followSchema.safeParse({ ...validFollow, id: "not-a-uuid" }).success
    ).toBe(false);
  });

  it("rejects a non-uuid userId", () => {
    expect(
      followSchema.safeParse({ ...validFollow, userId: "123" }).success
    ).toBe(false);
  });

  it("rejects a non-uuid productId", () => {
    expect(
      followSchema.safeParse({ ...validFollow, productId: "abc" }).success
    ).toBe(false);
  });

  it("rejects a missing createdAt", () => {
    const { createdAt: _omit, ...rest } = validFollow;
    expect(followSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects extra keys (strict)", () => {
    expect(
      followSchema.safeParse({ ...validFollow, extra: true }).success
    ).toBe(false);
  });
});

describe("followedProductSchema", () => {
  const valid = {
    productId: "550e8400-e29b-41d4-a716-446655440002",
    name: "ทุเรียน",
    category: "ผลไม้",
    unit: "กก.",
    followedAt: "2026-07-08T14:00:00.000Z",
  };

  it("accepts a valid followed product", () => {
    expect(followedProductSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-uuid productId", () => {
    expect(
      followedProductSchema.safeParse({ ...valid, productId: "x" }).success
    ).toBe(false);
  });

  it("rejects a missing name", () => {
    const { name: _omit, ...rest } = valid;
    expect(followedProductSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects extra keys (strict)", () => {
    expect(
      followedProductSchema.safeParse({ ...valid, extra: true }).success
    ).toBe(false);
  });
});
