// @agrimarket/shared — stack-agnostic shared code.
// Will hold zod schemas, TS enums (CreditTier, KycStatus, DemandStatus, ...),
// and pure business logic (e.g. the Bounded Knapsack best-offer solver).
// No React, no Prisma here.

export const SHARED_PACKAGE_VERSION = "0.0.0";

// Auth schemas (shared between API request validation + client form validation).
export * from "./auth/schemas";
export * from "./auth/normalize-phone";

// User enums (CreditTier, KycStatus).
export * from "./users/enums";

// Catalog: product/grade zod schemas + default-grade helper (Issue 04).
export * from "./catalog/default-grade";
export * from "./catalog/schemas";
