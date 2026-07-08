// @agrimarket/shared — stack-agnostic shared code.
// Will hold zod schemas, TS enums (CreditTier, KycStatus, DemandStatus, ...),
// and pure business logic (e.g. the Bounded Knapsack best-offer solver).
// No React, no Prisma here.

export const SHARED_PACKAGE_VERSION = "0.0.0";

// Auth schemas (shared between API request validation + client form validation).
export * from "./auth/schemas";
export * from "./auth/normalize-phone";

// User enums (CreditTier, KycStatus) + KYC submissions (Issue 06).
export * from "./users/enums";
export * from "./users/kyc-status";
export * from "./users/kyc-transitions";
export * from "./users/kyc-schemas";

// Catalog: product/grade zod schemas + default-grade helper (Issue 04).
export * from "./catalog/default-grade";
export * from "./catalog/schemas";

// Catalog: product suggestions (Issue 05).
export * from "./catalog/suggestion-schemas";

// Demand: lifecycle enums, zod schemas, transitions (Issue 07, extended 08),
// background-job predicates (Issue 09 auto-expire/complete), counter-offer
// acceptance threshold (Issues 11 + 12), best-offer knapsack solver +
// haversine distance tiebreaker (Issue 13).
export * from "./demand/enums";
export * from "./demand/schemas";
export * from "./demand/demand-transitions";
export * from "./demand/demand-jobs";
export * from "./demand/counter-offer";
export * from "./demand/haversine-km";
export * from "./demand/best-offer";

// Offer: lifecycle enums + transitions (Issue 08 vocabulary for the demand-
// cancel cascade + offer-acceptance gate; the offers table lands in #10) +
// schemas + edit/withdraw gates (Issue 10).
export * from "./offer/enums";
export * from "./offer/offer-transitions";
export * from "./offer/schemas";
