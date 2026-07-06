import { describe, it, expect } from "vitest";
import { decideAdminGate } from "./require-admin";
import type { CurrentUser } from "./get-profile";

function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    phone: "0812345678",
    tier: "None",
    kycStatus: "None",
    buyerScore: 0,
    sellerScore: 0,
    isAdmin: false,
    isRider: false,
    isHubStaff: false,
    hubId: null,
    ...overrides,
  };
}

describe("decideAdminGate", () => {
  it("denies anonymous access with 401", () => {
    const result = decideAdminGate(null);
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("denies a non-admin authenticated user with 403", () => {
    const result = decideAdminGate(makeUser({ isAdmin: false }));
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("allows an admin user and returns the user", () => {
    const admin = makeUser({ isAdmin: true, phone: "0899999901" });
    const result = decideAdminGate(admin);
    expect(result).toEqual({ ok: true, user: admin });
  });

  it("treats KYC/KYC-pending users like any other (admin gate only checks isAdmin)", () => {
    const kycPendingAdmin = makeUser({
      isAdmin: true,
      kycStatus: "Pending",
    });
    expect(decideAdminGate(kycPendingAdmin).ok).toBe(true);

    const kycApprovedNonAdmin = makeUser({
      isAdmin: false,
      kycStatus: "Approved",
    });
    expect(decideAdminGate(kycApprovedNonAdmin).ok).toBe(false);
  });
});
