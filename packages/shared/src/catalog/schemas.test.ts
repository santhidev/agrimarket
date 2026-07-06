import { describe, it, expect } from "vitest";
import {
  createProductSchema,
  updateProductSchema,
  createGradeSchema,
  updateGradeSchema,
  productSchema,
  productGradeSchema,
} from "./schemas";

describe("createProductSchema", () => {
  it("accepts a minimal valid product (name + category)", () => {
    expect(
      createProductSchema.safeParse({ name: "มะม่วงน้ำดอกไม้", category: "ผลไม้" })
        .success
    ).toBe(true);
  });

  it("applies documented defaults for omitted optional fields", () => {
    const parsed = createProductSchema.safeParse({
      name: "ข้าวหอมมะลิ",
      category: "ข้าว",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.unit).toBe("กก.");
      expect(parsed.data.requiresColdChain).toBe(false);
      expect(parsed.data.isFragile).toBe(false);
      expect(parsed.data.isStackable).toBe(true);
      expect(parsed.data.shelfLifeHours).toBeNull();
    }
  });

  it("accepts a fully-specified product", () => {
    expect(
      createProductSchema.safeParse({
        name: "สตรอว์เบอร์รี",
        category: "ผลไม้",
        unit: "แพ",
        requiresColdChain: true,
        isFragile: true,
        shelfLifeHours: 72,
        isStackable: false,
      }).success
    ).toBe(true);
  });

  it("rejects a missing name", () => {
    expect(createProductSchema.safeParse({ category: "ผลไม้" }).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(
      createProductSchema.safeParse({ name: "   ", category: "ผลไม้" }).success
    ).toBe(false);
  });

  it("rejects a missing category", () => {
    expect(createProductSchema.safeParse({ name: "มะม่วง" }).success).toBe(false);
  });

  it("rejects a non-positive shelf_life_hours", () => {
    expect(
      createProductSchema.safeParse({
        name: "มะม่วง",
        category: "ผลไม้",
        shelfLifeHours: 0,
      }).success
    ).toBe(false);
  });

  it("rejects an unknown top-level field when strict", () => {
    // schemas are strict so typos in field names surface immediately
    expect(
      createProductSchema.safeParse({
        name: "มะม่วง",
        category: "ผลไม้",
        frozzle: true,
      }).success
    ).toBe(false);
  });
});

describe("updateProductSchema", () => {
  it("accepts an empty body (no-op patch)", () => {
    expect(updateProductSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a partial update", () => {
    expect(
      updateProductSchema.safeParse({ name: "มะม่วงเบอร์ด" }).success
    ).toBe(true);
  });

  it("still validates provided fields (empty name rejected)", () => {
    expect(updateProductSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("still validates shelf_life_hours", () => {
    expect(
      updateProductSchema.safeParse({ shelfLifeHours: -1 }).success
    ).toBe(false);
  });
});

describe("createGradeSchema", () => {
  it("accepts a name", () => {
    expect(createGradeSchema.safeParse({ name: "A" }).success).toBe(true);
  });

  it("defaults sortOrder to 0 and allows optional description", () => {
    const parsed = createGradeSchema.safeParse({ name: "A", description: "พิเศษ" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.sortOrder).toBe(0);
      expect(parsed.data.description).toBe("พิเศษ");
    }
  });

  it("rejects a missing name", () => {
    expect(createGradeSchema.safeParse({ description: "x" }).success).toBe(false);
  });

  it("rejects a negative sortOrder", () => {
    expect(
      createGradeSchema.safeParse({ name: "A", sortOrder: -1 }).success
    ).toBe(false);
  });
});

describe("updateGradeSchema", () => {
  it("accepts a partial update", () => {
    expect(updateGradeSchema.safeParse({ sortOrder: 5 }).success).toBe(true);
  });

  it("rejects an empty name when provided", () => {
    expect(updateGradeSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("productSchema (API read shape)", () => {
  const valid = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "มะม่วง",
    category: "ผลไม้",
    unit: "กก.",
    requiresColdChain: false,
    isFragile: false,
    shelfLifeHours: null,
    isStackable: true,
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
  };

  it("accepts a well-shaped product", () => {
    expect(productSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a non-null shelfLifeHours", () => {
    expect(
      productSchema.safeParse({ ...valid, shelfLifeHours: 48 }).success
    ).toBe(true);
  });

  it("rejects a non-UUID id", () => {
    expect(productSchema.safeParse({ ...valid, id: "nope" }).success).toBe(false);
  });
});

describe("productGradeSchema (API read shape)", () => {
  const valid = {
    id: "660e8400-e29b-41d4-a716-446655440000",
    productId: "550e8400-e29b-41d4-a716-446655440000",
    name: "A",
    description: null,
    sortOrder: 0,
  };

  it("accepts a well-shaped grade", () => {
    expect(productGradeSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-numeric sortOrder", () => {
    expect(
      productGradeSchema.safeParse({ ...valid, sortOrder: "0" }).success
    ).toBe(false);
  });
});
