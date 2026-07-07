import { describe, it, expect } from "vitest";
import {
  createDemandSchema,
  extendDemandSchema,
  demandQuerySchema,
  demandSchema,
  counterOfferSchema,
  DemandStatus,
} from "./schemas";

const validCreate = {
  productId: "550e8400-e29b-41d4-a716-446655440000",
  quantity: 100,
  deadline: "2099-12-31T23:59:59.000Z",
  buyerLat: 13.7563,
  buyerLng: 100.5018,
};

describe("createDemandSchema", () => {
  it("accepts a well-shaped demand", () => {
    expect(createDemandSchema.safeParse(validCreate).success).toBe(true);
  });

  it("rejects a missing productId", () => {
    expect(
      createDemandSchema.safeParse({ ...validCreate, productId: undefined })
        .success
    ).toBe(false);
  });

  it("rejects a non-UUID productId", () => {
    expect(
      createDemandSchema.safeParse({ ...validCreate, productId: "nope" })
        .success
    ).toBe(false);
  });

  it("rejects a non-positive quantity", () => {
    expect(
      createDemandSchema.safeParse({ ...validCreate, quantity: 0 }).success
    ).toBe(false);
    expect(
      createDemandSchema.safeParse({ ...validCreate, quantity: -5 }).success
    ).toBe(false);
  });

  it("rejects a non-integer quantity", () => {
    expect(
      createDemandSchema.safeParse({ ...validCreate, quantity: 1.5 }).success
    ).toBe(false);
  });

  it("rejects a deadline in the past", () => {
    expect(
      createDemandSchema.safeParse({
        ...validCreate,
        deadline: "2020-01-01T00:00:00.000Z",
      }).success
    ).toBe(false);
  });

  it("rejects buyerLat outside -90..90", () => {
    expect(
      createDemandSchema.safeParse({ ...validCreate, buyerLat: 91 }).success
    ).toBe(false);
    expect(
      createDemandSchema.safeParse({ ...validCreate, buyerLat: -91 }).success
    ).toBe(false);
  });

  it("rejects buyerLng outside -180..180", () => {
    expect(
      createDemandSchema.safeParse({ ...validCreate, buyerLng: 181 }).success
    ).toBe(false);
    expect(
      createDemandSchema.safeParse({ ...validCreate, buyerLng: -181 }).success
    ).toBe(false);
  });

  it("rejects unknown top-level fields (strict)", () => {
    expect(
      createDemandSchema.safeParse({ ...validCreate, bogus: true }).success
    ).toBe(false);
  });
});

describe("demandQuerySchema", () => {
  it("accepts an empty query (no filters)", () => {
    expect(demandQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts productId + status filters", () => {
    expect(
      demandQuerySchema.safeParse({
        productId: "550e8400-e29b-41d4-a716-446655440000",
        status: DemandStatus.Open,
      }).success
    ).toBe(true);
  });

  it("rejects an invalid status value", () => {
    expect(
      demandQuerySchema.safeParse({ status: "WAT" }).success
    ).toBe(false);
  });

  it("rejects a non-UUID productId", () => {
    expect(
      demandQuerySchema.safeParse({ productId: "nope" }).success
    ).toBe(false);
  });

  it("strips unknown keys (no strict) so Next.js searchParams extras don't 400", () => {
    const parsed = demandQuerySchema.safeParse({ foo: "bar", status: "OPEN" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("foo");
      expect(parsed.data.status).toBe("OPEN");
    }
  });
});

describe("demandSchema (API read shape)", () => {
  const valid = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    productId: "660e8400-e29b-41d4-a716-446655440000",
    productName: "มะม่วงน้ำดอกไม้",
    unit: "กก.",
    buyerId: "770e8400-e29b-41d4-a716-446655440000",
    quantity: 100,
    pendingQuantity: 100,
    status: DemandStatus.Open,
    buyerLat: 13.7563,
    buyerLng: 100.5018,
    deadline: "2099-12-31T23:59:59.000Z",
    counterOfferPrice: null,
    counterOfferAt: null,
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
    offers: [],
  };

  it("accepts a well-shaped OPEN demand with no offers yet", () => {
    expect(demandSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts any status value from the lifecycle", () => {
    for (const s of [
      DemandStatus.Open,
      DemandStatus.Matched,
      DemandStatus.Completed,
      DemandStatus.Expired,
      DemandStatus.Cancelled,
    ]) {
      expect(demandSchema.safeParse({ ...valid, status: s }).success).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    expect(
      demandSchema.safeParse({ ...valid, status: "WAT" }).success
    ).toBe(false);
  });

  it("rejects a negative pendingQuantity", () => {
    expect(
      demandSchema.safeParse({ ...valid, pendingQuantity: -1 }).success
    ).toBe(false);
  });
});

// extendDemandSchema (Issue 08): PATCH /api/demands/:id body. The only field a
// buyer may extend is the deadline (Issue 08 scope) — quantity/product/lat-lng
// are immutable after create, and status is route-controlled on cancel. The
// new deadline must be in the future (same rule as create); the route also
// enforces "must be later than the current deadline" via isDeadlineExtension.
describe("extendDemandSchema", () => {
  const future = "2099-12-31T23:59:59.000Z";

  it("accepts a future deadline", () => {
    expect(extendDemandSchema.safeParse({ deadline: future }).success).toBe(true);
  });

  it("rejects a missing deadline", () => {
    expect(extendDemandSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a deadline in the past", () => {
    expect(
      extendDemandSchema.safeParse({ deadline: "2020-01-01T00:00:00.000Z" })
        .success
    ).toBe(false);
  });

  it("rejects a malformed deadline string", () => {
    expect(extendDemandSchema.safeParse({ deadline: "next week" }).success).toBe(
      false
    );
  });

  it("rejects unknown top-level fields (strict)", () => {
    expect(
      extendDemandSchema.safeParse({ deadline: future, quantity: 50 }).success
    ).toBe(false);
  });
});

// counterOfferSchema (Issues 11 + 12): POST /api/demands/:id/counter-offer body.
// The buyer sends a desired price; sellers respond by editing their own offer
// price down (reusing PATCH from #10). The price must be positive — a
// counter-offer of 0 or negative is nonsensical (the buyer is asking sellers to
// give goods away). The route applies canEditDemand (OPEN-only) separately.
describe("counterOfferSchema", () => {
  it("accepts a positive price", () => {
    expect(counterOfferSchema.safeParse({ pricePerUnit: 20 }).success).toBe(true);
  });

  it("rejects a missing pricePerUnit", () => {
    expect(counterOfferSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-positive price", () => {
    expect(counterOfferSchema.safeParse({ pricePerUnit: 0 }).success).toBe(false);
    expect(counterOfferSchema.safeParse({ pricePerUnit: -5 }).success).toBe(false);
  });

  it("rejects unknown top-level fields (strict)", () => {
    expect(
      counterOfferSchema.safeParse({ pricePerUnit: 20, note: "pls" }).success
    ).toBe(false);
  });
});

// demandSchema (API read shape) — counter-offer fields (Issues 11 + 12).
// counterOfferPrice is null until the buyer sends a counter-offer; once set it
// stays until the buyer sends another (unlimited rounds, latest wins).
// counterOfferAt is the timestamp of the latest counter-offer.
describe("demandSchema counter-offer fields", () => {
  const base = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    productId: "660e8400-e29b-41d4-a716-446655440000",
    productName: "มะม่วงน้ำดอกไม้",
    unit: "กก.",
    buyerId: "770e8400-e29b-41d4-a716-446655440000",
    quantity: 100,
    pendingQuantity: 100,
    status: DemandStatus.Open,
    buyerLat: 13.7563,
    buyerLng: 100.5018,
    deadline: "2099-12-31T23:59:59.000Z",
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
    offers: [],
  };

  it("accepts a demand with no counter-offer yet (both null)", () => {
    expect(
      demandSchema.safeParse({ ...base, counterOfferPrice: null, counterOfferAt: null })
        .success
    ).toBe(true);
  });

  it("accepts a demand with an active counter-offer", () => {
    expect(
      demandSchema.safeParse({
        ...base,
        counterOfferPrice: 20,
        counterOfferAt: "2026-07-08T00:00:00.000Z",
      }).success
    ).toBe(true);
  });
});
