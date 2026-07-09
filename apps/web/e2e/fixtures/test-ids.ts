// Fixed test identifiers for E2E (Issue 19).
//
// These phones are reused across runs (idempotent — OTP verify is find-or-
// create). The buyer/seller/admin are seeded in globalSetup and their sessions
// persisted via storageState. Demands/offers are created + cleaned up per run.

export const TEST = {
  buyer: { phone: "0800000001", storageState: "apps/web/.auth/buyer.json" },
  seller: { phone: "0800000002", storageState: "apps/web/.auth/seller.json" },
  admin: { phone: "0800000003", storageState: "apps/web/.auth/admin.json" },
} as const;

// The product the happy path creates a demand for. globalSetup ensures this
// product (or an existing one) + a grade exist before the test runs.
export const PRODUCT_NAME = "มะม่วง";

// Demand created per run — deadline +7d to stay clear of the 5-min auto-expire
// cron during the test.
export const DEMAND = {
  quantity: 100,
  deadlineDaysAhead: 7,
  lat: 13.7563,
  lng: 100.5018,
} as const;

// The offer the seller submits.
export const OFFER = {
  pricePerUnit: 80,
  quantity: 100,
  lat: 13.7563,
  lng: 100.5063,
  readyDateDaysAhead: 3,
} as const;

// InsForge env — globalSetup + helpers read these. The fallback chain reads
// the dev env names first (so local runs work without the E2E_-prefixed vars),
// then the E2E_-prefixed names (CI).
export const INSFORGE = {
  url: process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.E2E_INSFORGE_URL!,
  anonKey:
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ??
    process.env.E2E_INSFORGE_ANON_KEY!,
  apiKey: process.env.INSFORGE_API_KEY ?? process.env.E2E_INSFORGE_API_KEY!,
  baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
} as const;
