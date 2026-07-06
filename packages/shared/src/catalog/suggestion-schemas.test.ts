import { describe, it, expect } from "vitest";
import {
  createProductSuggestionSchema,
  rejectProductSuggestionSchema,
  productSuggestionSchema,
  buildProductFromSuggestion,
  SuggestionStatus,
} from "./suggestion-schemas";

describe("createProductSuggestionSchema", () => {
  it("accepts a minimal valid suggestion (name + category)", () => {
    expect(
      createProductSuggestionSchema.safeParse({
        name: "มะระจีน",
        category: "ผัก",
      }).success
    ).toBe(true);
  });

  it("defaults unit to 'กก.' when omitted", () => {
    const parsed = createProductSuggestionSchema.safeParse({
      name: "มะระจีน",
      category: "ผัก",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.unit).toBe("กก.");
    }
  });

  it("accepts a custom unit", () => {
    expect(
      createProductSuggestionSchema.safeParse({
        name: "ไข่ไก่",
        category: "เนื้อสัตว์",
        unit: "แพ",
      }).success
    ).toBe(true);
  });

  it("rejects a missing name", () => {
    expect(
      createProductSuggestionSchema.safeParse({ category: "ผัก" }).success
    ).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(
      createProductSuggestionSchema.safeParse({ name: "   ", category: "ผัก" })
        .success
    ).toBe(false);
  });

  it("rejects a missing category", () => {
    expect(
      createProductSuggestionSchema.safeParse({ name: "มะระจีน" }).success
    ).toBe(false);
  });

  it("rejects an unknown top-level field (strict)", () => {
    expect(
      createProductSuggestionSchema.safeParse({
        name: "มะระจีน",
        category: "ผัก",
        bogus: true,
      }).success
    ).toBe(false);
  });
});

describe("rejectProductSuggestionSchema", () => {
  it("accepts a non-empty rejection reason", () => {
    expect(
      rejectProductSuggestionSchema.safeParse({
        rejectionReason: "มีสินค้านี้ในแคตตาล็อกแล้ว",
      }).success
    ).toBe(true);
  });

  it("rejects a missing reason", () => {
    expect(rejectProductSuggestionSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty/whitespace reason", () => {
    expect(
      rejectProductSuggestionSchema.safeParse({ rejectionReason: "   " })
        .success
    ).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    expect(
      rejectProductSuggestionSchema.safeParse({
        rejectionReason: "x",
        extra: 1,
      }).success
    ).toBe(false);
  });
});

describe("buildProductFromSuggestion", () => {
  const suggestion = {
    name: "มะระจีน",
    category: "ผัก",
    unit: "แพ",
  };

  it("carries name/category/unit from the suggestion", () => {
    const product = buildProductFromSuggestion(suggestion);
    expect(product).toMatchObject({
      name: "มะระจีน",
      category: "ผัก",
      unit: "แพ",
    });
  });

  it("applies the catalog defaults for the non-suggested fields", () => {
    const product = buildProductFromSuggestion(suggestion);
    expect(product.requires_cold_chain).toBe(false);
    expect(product.is_fragile).toBe(false);
    expect(product.is_stackable).toBe(true);
    expect(product.shelf_life_hours).toBeNull();
  });

  it("uses 'กก.' when the suggestion has no unit", () => {
    const product = buildProductFromSuggestion({
      name: "มะระจีน",
      category: "ผัก",
    });
    expect(product.unit).toBe("กก.");
  });
});

describe("productSuggestionSchema (API read shape)", () => {
  const valid = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    requesterId: "660e8400-e29b-41d4-a716-446655440000",
    name: "มะระจีน",
    category: "ผัก",
    unit: "กก.",
    status: SuggestionStatus.Pending,
    rejectionReason: null,
    reviewedBy: null,
    submittedAt: "2026-07-07T00:00:00.000Z",
    reviewedAt: null,
  };

  it("accepts a well-shaped pending suggestion", () => {
    expect(productSuggestionSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an approved suggestion (no rejection reason, has reviewer)", () => {
    expect(
      productSuggestionSchema.safeParse({
        ...valid,
        status: SuggestionStatus.Approved,
        reviewedBy: "770e8400-e29b-41d4-a716-446655440000",
        reviewedAt: "2026-07-07T01:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("accepts a rejected suggestion with a reason", () => {
    expect(
      productSuggestionSchema.safeParse({
        ...valid,
        status: SuggestionStatus.Rejected,
        rejectionReason: "รายการซ้ำ",
        reviewedBy: "770e8400-e29b-41d4-a716-446655440000",
        reviewedAt: "2026-07-07T01:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("rejects an unknown status value", () => {
    expect(
      productSuggestionSchema.safeParse({ ...valid, status: "WAT" }).success
    ).toBe(false);
  });

  it("rejects a non-UUID id", () => {
    expect(
      productSuggestionSchema.safeParse({ ...valid, id: "nope" }).success
    ).toBe(false);
  });
});
