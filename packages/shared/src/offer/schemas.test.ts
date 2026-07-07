import { describe, it, expect } from "vitest";
import { createOfferSchema, updateOfferSchema } from "./schemas";

// Offer request schemas (Issue 10).
//
// createOfferSchema validates POST /api/offers: the seller posts the demand
// they're responding to, their price/quantity/grade/location/ready_date, and
// the photos they uploaded to Storage (url+key pairs, like KYC #06).
// updateOfferSchema validates PATCH /api/offers/:id: a partial body where
// every field is optional but at least one must be present (a no-op PATCH is
// a client bug). Both are .strict() — unknown fields 400, matching the
// demand/kyc schema convention.

const validPhoto = { url: "https://cdn.example.com/p1.jpg", key: "offers/p1.jpg" };
const validCreate = {
  demandId: "550e8400-e29b-41d4-a716-446655440000",
  pricePerUnit: 25,
  quantity: 100,
  photos: [validPhoto],
  pickupLat: 13.75,
  pickupLng: 100.5,
  readyDate: "2026-08-01",
};

describe("createOfferSchema", () => {
  it("accepts a complete valid body", () => {
    const parsed = createOfferSchema.safeParse(validCreate);
    expect(parsed.success).toBe(true);
  });

  it("accepts a body without productGradeId (grade is optional)", () => {
    const parsed = createOfferSchema.safeParse(validCreate);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.productGradeId).toBeUndefined();
    }
  });

  it("accepts a body with productGradeId", () => {
    const parsed = createOfferSchema.safeParse({
      ...validCreate,
      productGradeId: "660e8400-e29b-41d4-a716-446655440001",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty photos array (photos are optional in practice)", () => {
    const parsed = createOfferSchema.safeParse({ ...validCreate, photos: [] });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing demandId", () => {
    const { demandId: _, ...noDemand } = validCreate;
    expect(createOfferSchema.safeParse(noDemand).success).toBe(false);
  });

  it("rejects pricePerUnit <= 0", () => {
    expect(
      createOfferSchema.safeParse({ ...validCreate, pricePerUnit: 0 }).success
    ).toBe(false);
    expect(
      createOfferSchema.safeParse({ ...validCreate, pricePerUnit: -5 }).success
    ).toBe(false);
  });

  it("rejects quantity <= 0", () => {
    expect(
      createOfferSchema.safeParse({ ...validCreate, quantity: 0 }).success
    ).toBe(false);
  });

  it("rejects a readyDate in the past", () => {
    expect(
      createOfferSchema.safeParse({ ...validCreate, readyDate: "2020-01-01" })
        .success
    ).toBe(false);
  });

  it("rejects a photo missing url or key", () => {
    expect(
      createOfferSchema.safeParse({
        ...validCreate,
        photos: [{ url: "https://cdn.example.com/p1.jpg" }],
      }).success
    ).toBe(false);
  });

  it("rejects an unknown field (.strict)", () => {
    expect(
      createOfferSchema.safeParse({ ...validCreate, extra: "bad" }).success
    ).toBe(false);
  });

  it("rejects lat/lng out of range", () => {
    expect(
      createOfferSchema.safeParse({ ...validCreate, pickupLat: 91 }).success
    ).toBe(false);
    expect(
      createOfferSchema.safeParse({ ...validCreate, pickupLng: -181 }).success
    ).toBe(false);
  });
});

describe("updateOfferSchema", () => {
  it("accepts a partial update (price only)", () => {
    const parsed = updateOfferSchema.safeParse({ pricePerUnit: 30 });
    expect(parsed.success).toBe(true);
  });

  it("accepts updating multiple fields", () => {
    const parsed = updateOfferSchema.safeParse({
      pricePerUnit: 30,
      quantity: 200,
      readyDate: "2026-09-01",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts updating photos (replace wholesale)", () => {
    const parsed = updateOfferSchema.safeParse({
      photos: [validPhoto, { url: "https://x/y.jpg", key: "k" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty body (at least one field required)", () => {
    expect(updateOfferSchema.safeParse({}).success).toBe(false);
  });

  it("rejects pricePerUnit <= 0 when present", () => {
    expect(
      updateOfferSchema.safeParse({ pricePerUnit: 0 }).success
    ).toBe(false);
  });

  it("rejects an unknown field (.strict)", () => {
    expect(
      updateOfferSchema.safeParse({ pricePerUnit: 30, extra: "bad" }).success
    ).toBe(false);
  });

  it("rejects demandId (immutable after create)", () => {
    expect(
      updateOfferSchema.safeParse({
        demandId: "550e8400-e29b-41d4-a716-446655440000",
      }).success
    ).toBe(false);
  });
});
