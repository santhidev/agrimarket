import { describe, it, expect } from "vitest";
import { userFilterSchema, setCreditTierSchema } from "./schemas";
import { CreditTier, KycStatus } from "../users/enums";

describe("userFilterSchema", () => {
  it("accepts an empty query (all optional with defaults)", () => {
    const parsed = userFilterSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(50);
    expect(parsed.search).toBeUndefined();
    expect(parsed.kycStatus).toBeUndefined();
    expect(parsed.tier).toBeUndefined();
  });

  it("coerces page/pageSize from string", () => {
    const parsed = userFilterSchema.parse({ page: "3", pageSize: "25" });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(25);
  });

  it("accepts all four filters together", () => {
    const parsed = userFilterSchema.parse({
      search: "081234",
      kycStatus: KycStatus.Approved,
      tier: CreditTier.Gold,
      page: 2,
      pageSize: 20,
    });
    expect(parsed).toEqual({
      search: "081234",
      kycStatus: KycStatus.Approved,
      tier: CreditTier.Gold,
      page: 2,
      pageSize: 20,
    });
  });

  it("rejects an unknown kycStatus", () => {
    const parsed = userFilterSchema.safeParse({ kycStatus: "WHATEVER" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown tier", () => {
    const parsed = userFilterSchema.safeParse({ tier: "Platinum" });
    expect(parsed.success).toBe(false);
  });

  it("rejects page <= 0", () => {
    expect(userFilterSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(userFilterSchema.safeParse({ page: "-1" }).success).toBe(false);
  });

  it("caps pageSize at 200", () => {
    expect(userFilterSchema.safeParse({ pageSize: 201 }).success).toBe(false);
    expect(userFilterSchema.safeParse({ pageSize: 200 }).success).toBe(true);
  });

  it("trims search whitespace", () => {
    const parsed = userFilterSchema.parse({ search: "  081  " });
    expect(parsed.search).toBe("081");
  });

  it("rejects unknown keys (strict)", () => {
    const parsed = userFilterSchema.safeParse({ foo: "bar" });
    expect(parsed.success).toBe(false);
  });
});

describe("setCreditTierSchema", () => {
  it("accepts each valid tier", () => {
    for (const t of [CreditTier.None, CreditTier.Bronze, CreditTier.Silver, CreditTier.Gold]) {
      expect(setCreditTierSchema.safeParse({ tier: t }).success).toBe(true);
    }
  });

  it("rejects an unknown tier", () => {
    expect(setCreditTierSchema.safeParse({ tier: "Platinum" }).success).toBe(false);
  });

  it("rejects a missing tier", () => {
    expect(setCreditTierSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    expect(setCreditTierSchema.safeParse({ tier: CreditTier.Gold, extra: 1 }).success).toBe(false);
  });
});
