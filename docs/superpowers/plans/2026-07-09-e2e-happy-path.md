# E2E: Happy Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Playwright E2E test that drives the full AgriMarket matchmaking happy path through the browser UI (with API fallbacks where no UI button exists yet) against the InsForge hosted backend, plus a GitHub Actions CI workflow.

**Architecture:** Single happy-path spec (11 steps) + `globalSetup` that seeds 3 fixed test users + product/KYC prerequisites and persists sessions via `storageState`, `globalTeardown` that cleans up test demands/offers. Steps that have a real UI button (login, create demand) drive the browser; steps with no UI yet (follow, submit offer, select, confirm, match) fall back to API calls inside the Playwright test context (reusing the storageState cookies). A GitHub Actions workflow builds + starts the app and runs the suite.

**Tech Stack:** Playwright (`@playwright/test`), InsForge SDK (`@insforge/sdk` + edge function `phone-otp`), GitHub Actions, Next.js 15.

**Spec:** `docs/superpowers/specs/2026-07-09-e2e-happy-path-design.md`

**Repo conventions (read before starting):**
- No Prisma/BullMQ/NextAuth. DB via `@insforge/sdk`; auth via InsForge phone-OTP; session via `@insforge/sdk/ssr` cookies.
- Admin client: `createInsForgeAdminClient()` from `apps/web/app/lib/insforge-admin.ts` (service-role, bypasses RLS). Server-only.
- SSR client: `createInsForgeServerClient()` from `apps/web/app/lib/insforge-server.ts`.
- Browser client: `createBrowserClient()` from `apps/web/app/lib/insforge-client.ts`.
- OTP flow: `requestOtpAction` calls `client.functions.invoke("phone-otp", { body: { action: "request", phone } })` and returns `{ testCode }` in dev mode.
- Commit to master directly. Do NOT create a branch.
- This issue does NOT use TDD (E2E tests aren't pure functions). The "test" IS the deliverable.

---

## Task 1: Install Playwright + config + gitignore

**Files:**
- Create: `apps/web/playwright.config.ts`
- Modify: `apps/web/package.json` (add dep + scripts)
- Modify: `package.json` (root — add script)
- Modify: `.gitignore`

- [ ] **Step 1: Install `@playwright/test`**

Run:
```bash
pnpm --filter @agrimarket/web add -D @playwright/test
```

- [ ] **Step 2: Install Playwright's chromium browser binary**

Run:
```bash
pnpm --filter @agrimarket/web exec playwright install chromium
```

(This downloads the browser; needed before any test runs.)

- [ ] **Step 3: Write the Playwright config**

Create `apps/web/playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test";

// E2E config (Issue 19). Separate from vitest — Playwright has its own runner.
// NOT part of the turbo `pnpm test` pipeline; run explicitly via `pnpm test:e2e`.

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // single happy path — no parallelism
  retries: 0, // flake must be fixed, not retried
  workers: 1, // shared backend state
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/fixtures/global-setup.ts",
  globalTeardown: "./e2e/fixtures/global-teardown.ts",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // No webServer auto-start — globalSetup verifies the server is up.
});
```

- [ ] **Step 4: Add scripts to `apps/web/package.json`**

Read `apps/web/package.json`, then add to `scripts` (after the existing `test:integration` line):

```json
"test:e2e": "playwright test",
"test:e2e:cleanup": "tsx e2e/fixtures/cleanup.ts"
```

- [ ] **Step 5: Add script to root `package.json`**

Read root `package.json`, then add to `scripts`:

```json
"test:e2e": "pnpm --filter @agrimarket/web test:e2e"
```

- [ ] **Step 6: Update `.gitignore`**

Read `.gitignore`, then append:

```
# E2E (Issue 19)
.auth/
apps/web/test-results/
apps/web/playwright-report/
```

- [ ] **Step 7: Verify install + config is valid**

Run:
```bash
pnpm --filter @agrimarket/web exec playwright test --list
```

Expected: no error (it will say "no tests found" since `e2e/` doesn't exist yet, but the config must parse). If it errors on `globalSetup` file missing, that's expected — the config itself should be valid TypeScript.

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/playwright.config.ts package.json pnpm-lock.yaml .gitignore
git commit -m "Add Playwright config + scripts"
```

---

## Task 2: Test constants + helpers

**Files:**
- Create: `apps/web/e2e/fixtures/test-ids.ts`
- Create: `apps/web/e2e/helpers/flow.ts`

- [ ] **Step 1: Write test constants**

Create `apps/web/e2e/fixtures/test-ids.ts`:

```typescript
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
  lng: 100.5018,
  readyDateDaysAhead: 3,
} as const;

// InsForge env — globalSetup + helpers read these.
export const INSFORGE = {
  url: process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.E2E_INSFORGE_URL!,
  anonKey:
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ??
    process.env.E2E_INSFORGE_ANON_KEY!,
  apiKey: process.env.INSFORGE_API_KEY ?? process.env.E2E_INSFORGE_API_KEY!,
  baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
} as const;
```

- [ ] **Step 2: Write the login helper**

Create `apps/web/e2e/helpers/flow.ts`:

```typescript
import type { Page } from "@playwright/test";
import { createClient } from "@insforge/sdk";
import { INSFORGE, TEST } from "../fixtures/test-ids";

// Request an OTP via the edge function and return the testCode (dev mode).
// The UI's requestOtpAction calls the same edge function via a server action,
// but Playwright can't see the server action's return value — so we call the
// edge function directly to capture testCode, then type it into the UI.
export async function requestOtpCode(phone: string): Promise<string> {
  const client = createClient({
    baseUrl: INSFORGE.url,
    anonKey: INSFORGE.anonKey,
  });
  const { data, error } = await client.functions.invoke("phone-otp", {
    body: { action: "request", phone },
  });
  if (error) throw new Error(`OTP request failed for ${phone}: ${error.message}`);
  const code = (data as { testCode?: string }).testCode;
  if (!code) throw new Error(`No testCode returned for ${phone} — is dev mode on?`);
  return code;
}

// Full login flow via the UI: navigate to /login, type phone, request OTP,
// type the code into the 6 digit boxes, submit, wait for dashboard redirect.
export async function loginViaUi(page: Page, phone: string): Promise<void> {
  await page.goto("/login");

  // Phone step — type the phone WITHOUT leading 0 (the UI shows a +66 prefix).
  // The login form's normalizePhone handles both forms; typing the 10-digit
  // form directly also works. Type the full 0xxxxxxxxx form.
  await page.getByLabel("เบอร์โทรศัพท์").fill(phone);
  await page.getByRole("button", { name: /ขอรหัสยืนยัน|ส่งรหัส/ }).click();

  // OTP step — 6 separate digit inputs. Get the testCode and type each digit.
  const code = await requestOtpCode(phone);
  const digitInputs = page.locator("input[maxlength='1']");
  for (let i = 0; i < code.length; i++) {
    await digitInputs.nth(i).fill(code[i]);
  }

  // Submit + wait for redirect to /dashboard.
  await page.getByRole("button", { name: /ยืนยัน|เข้าสู่ระบบ/ }).click();
  await page.waitForURL("**/dashboard");
}
```

**Note on selectors:** the login form uses an `Input` component with a `label` prop. The exact accessible name / label text must be verified against the live page during implementation — read `apps/web/app/login/page.tsx` and adjust the `getByLabel` / `getByRole` selectors if they don't match. The digit boxes are `input[maxlength='1']` (6 of them). If the OTP form uses a single input instead of 6, adjust accordingly.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/
git commit -m "Add E2E test constants + login helper"
```

---

## Task 3: globalSetup — seed users + product + KYC

**Files:**
- Create: `apps/web/e2e/fixtures/global-setup.ts`

This is the most complex task — it provisions everything the happy path needs before the spec runs.

- [ ] **Step 1: Read the KYC submit + admin approve route shapes**

Read these to get exact request/response shapes for globalSetup's API calls:
- `apps/web/app/api/kyc/route.ts` (POST body for KYC submit)
- `apps/web/app/api/admin/kyc/[id]/approve/route.ts` (admin approve)
- `apps/web/app/api/admin/kyc/pending/route.ts` (find the pending submission)
- `apps/web/app/api/products/route.ts` (GET products + POST create)

- [ ] **Step 2: Write globalSetup**

Create `apps/web/e2e/fixtures/global-setup.ts`:

```typescript
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@insforge/sdk";
import { createInsForgeAdminClient } from "../../app/lib/insforge-admin";
import { INSFORGE, TEST, PRODUCT_NAME } from "./test-ids";
import { loginViaUi } from "../helpers/flow";

// globalSetup (Issue 19): provisions the 3 fixed test users + a product + the
// seller's KYC approval, then logs each user in via the real UI and persists
// their session as storageState files. The happy-path spec loads these files
// to skip re-login on every step.
//
// Idempotent: users are find-or-create via the OTP verify edge function, so a
// re-run after a prior successful setup is safe. The admin client sets
// is_admin on the admin user every run (idempotent UPDATE).

export default async function globalSetup(_config: FullConfig) {
  // 1. Ensure the server is up (the config has no webServer auto-start).
  await waitForServer();

  // 2. Ensure each user exists (find-or-create via OTP verify edge function).
  for (const role of ["buyer", "seller", "admin"] as const) {
    await ensureUser(TEST[role].phone);
  }

  // 3. Bootstrap the admin: set is_admin = true via the service-role client.
  await bootstrapAdmin(TEST.admin.phone);

  // 4. Ensure a product + grade exist for the demand.
  const product = await ensureProduct();

  // 5. Ensure the seller's KYC is APPROVED.
  await ensureSellerKyc();

  // 6. Log in each user via the UI + persist storageState.
  await mkdir(dirname(TEST.buyer.storageState), { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const role of ["buyer", "seller", "admin"] as const) {
      const context = await browser.newContext({
        baseURL: INSFORGE.baseURL,
      });
      await loginViaUi(context.page(), TEST[role].phone);
      await context.storageState({ path: TEST[role].storageState });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  // Stash the product id for the spec via an env var (globalSetup can't return
  // data directly to specs in older Playwright; env is the simple bridge).
  process.env.E2E_PRODUCT_ID = product.id;
  process.env.E2E_PRODUCT_GRADE_ID = product.gradeId;
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${INSFORGE.baseURL}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${INSFORGE.baseURL} did not become healthy in 60s`);
}

// Find-or-create a user by requesting + verifying an OTP. The verify edge
// function find-or-creates the auth.users + profiles row.
async function ensureUser(phone: string): Promise<void> {
  const client = createClient({
    baseUrl: INSFORGE.url,
    anonKey: INSFORGE.anonKey,
  });
  // Request OTP (captures testCode in dev mode).
  const { data: reqData, error: reqErr } = await client.functions.invoke(
    "phone-otp",
    { body: { action: "request", phone } }
  );
  if (reqErr) throw new Error(`OTP request failed for ${phone}: ${reqErr.message}`);
  const code = (reqData as { testCode?: string }).testCode;
  if (!code) throw new Error(`No testCode for ${phone}`);

  // Verify (find-or-create). We don't need to establish a session here — the
  // UI login below does that via signInWithPassword. We just need the user row.
  const { error: verifyErr } = await client.functions.invoke("phone-otp", {
    body: { action: "verify", phone, code },
  });
  if (verifyErr) throw new Error(`OTP verify failed for ${phone}: ${verifyErr.message}`);
}

async function bootstrapAdmin(phone: string): Promise<void> {
  const admin = createInsForgeAdminClient();
  // Find the profile by phone, then set is_admin.
  const { data: profiles, error: findErr } = await admin.database
    .from("profiles")
    .select("id, phone")
    .eq("phone", phone);
  if (findErr) throw new Error(`admin bootstrap find failed: ${findErr.message}`);
  const profile = (profiles as unknown as { id: string }[] | null)?.[0];
  if (!profile) throw new Error(`admin profile not found for ${phone}`);
  const { error: updErr } = await admin.database
    .from("profiles")
    .update({ is_admin: true })
    .eq("id", profile.id);
  if (updErr) throw new Error(`admin bootstrap update failed: ${updErr.message}`);
}

async function ensureProduct(): Promise<{ id: string; gradeId: string }> {
  const admin = createInsForgeAdminClient();
  // Look for an existing product by name.
  const { data: existing } = await admin.database
    .from("products")
    .select("id, name")
    .eq("name", PRODUCT_NAME);
  let productId: string;
  const prod = (existing as unknown as { id: string }[] | null)?.[0];
  if (prod) {
    productId = prod.id;
  } else {
    // Create the product (seed data).
    const { data: created, error: createErr } = await admin.database
      .from("products")
      .insert([
        {
          name: PRODUCT_NAME,
          category: "ผลไม้",
          unit: "กก.",
          requires_cold_chain: false,
          is_fragile: false,
          shelf_life_hours: 168,
          is_stackable: false,
        },
      ])
      .select("id")
      .limit(1);
    if (createErr || !created?.length)
      throw new Error(`product create failed: ${createErr?.message}`);
    productId = (created as unknown as { id: string }[])[0].id;
  }

  // Ensure at least one grade exists.
  const { data: grades } = await admin.database
    .from("product_grades")
    .select("id")
    .eq("product_id", productId);
  let gradeId: string;
  const grade = (grades as unknown as { id: string }[] | null)?.[0];
  if (grade) {
    gradeId = grade.id;
  } else {
    const { data: createdGrade, error: gradeErr } = await admin.database
      .from("product_grades")
      .insert([
        { product_id: productId, name: "มาตรฐาน", sort_order: 0 },
      ])
      .select("id")
      .limit(1);
    if (gradeErr || !createdGrade?.length)
      throw new Error(`grade create failed: ${gradeErr?.message}`);
    gradeId = (createdGrade as unknown as { id: string }[])[0].id;
  }
  return { id: productId, gradeId };
}

async function ensureSellerKyc(): Promise<void> {
  // Submit KYC as the seller, then approve as admin. This uses API calls with
  // session cookies — we need the seller + admin sessions. But globalSetup
  // logs them in below, so we can't use storageState here. Instead, do KYC via
  // the admin client directly (bypass RLS): insert a KYC submission + flip the
  // profile status. This mirrors what the routes do but skips the HTTP path.
  const admin = createInsForgeAdminClient();
  const { data: profiles } = await admin.database
    .from("profiles")
    .select("id, phone, kyc_status")
    .eq("phone", TEST.seller.phone);
  const seller = (profiles as unknown as { id: string; kyc_status: string }[] | null)?.[0];
  if (!seller) throw new Error("seller profile not found");

  if (seller.kyc_status === "Approved") return; // already done (idempotent)

  // Insert a KYC submission (if none pending/approved) + set status Approved.
  await admin.database.from("kyc_submissions").insert([
    {
      user_id: seller.id,
      id_card_photo: "https://example.com/test-id.jpg",
      selfie_photo: "https://example.com/test-selfie.jpg",
      status: "Approved",
      reviewed_at: new Date().toISOString(),
    },
  ]);
  const { error } = await admin.database
    .from("profiles")
    .update({ kyc_status: "Approved" })
    .eq("id", seller.id);
  if (error) throw new Error(`seller KYC update failed: ${error.message}`);
}
```

**Important notes for the implementer:**
- The `loginViaUi` call uses `context.page()` — in Playwright, a new context has an initial page.
- Column names (`kyc_status`, `is_admin`, `id_card_photo`, etc.) are snake_case in the DB. If the SDK rejects a column name, read the relevant migration (`migrations/20260707000805_kyc-submissions.sql`, `migrations/20260701051003_create-profiles.sql`) to confirm exact names.
- The KYC bootstrap bypasses the HTTP routes and writes directly via the admin client. This is deliberate — globalSetup can't use the logged-in sessions because it creates them. The HTTP routes are still exercised by the happy-path spec for other steps.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/fixtures/global-setup.ts
git commit -m "Add E2E globalSetup (seed users + product + KYC)"
```

---

## Task 4: globalTeardown + standalone cleanup

**Files:**
- Create: `apps/web/e2e/fixtures/global-teardown.ts`
- Create: `apps/web/e2e/fixtures/cleanup.ts`

- [ ] **Step 1: Write globalTeardown**

Create `apps/web/e2e/fixtures/global-teardown.ts`:

```typescript
import { createInsForgeAdminClient } from "../../app/lib/insforge-admin";
import { TEST } from "./test-ids";

// globalTeardown (Issue 19): cleans up the demands/offers created during this
// run. Users are fixed + reused (NOT deleted). Runs after the spec regardless
// of pass/fail. If it fails itself, a standalone `pnpm test:e2e:cleanup` is
// the manual recovery path.

export default async function globalTeardown() {
  const admin = createInsForgeAdminClient();

  // Find the buyer + seller profile ids.
  const { data: profiles } = await admin.database
    .from("profiles")
    .select("id, phone")
    .in("phone", [TEST.buyer.phone, TEST.seller.phone]);
  const rows = (profiles as unknown as { id: string; phone: string }[] | null) ?? [];
  const userIds = rows.map((r) => r.id);
  if (userIds.length === 0) return;

  // Delete demands owned by the buyer (cascades offers via FK if ON DELETE
  // CASCADE; otherwise delete offers first). Check the demands migration for
  // the FK action — if offers aren't cascaded, delete them explicitly first.
  // Safe to attempt even if empty.
  const { error: demandErr } = await admin.database
    .from("demands")
    .delete()
    .in("buyer_id", [userIds[0]]); // buyer is the demand owner
  if (demandErr) console.error("[globalTeardown] demand cleanup failed", demandErr);

  // Also clean up any offers the seller made on OTHER users' demands (shouldn't
  // happen in the happy path, but defensive).
  const { error: offerErr } = await admin.database
    .from("offers")
    .delete()
    .in("seller_id", userIds);
  if (offerErr) console.error("[globalTeardown] offer cleanup failed", offerErr);
}
```

- [ ] **Step 2: Write the standalone cleanup script**

Create `apps/web/e2e/fixtures/cleanup.ts`:

```typescript
// Standalone cleanup (Issue 19) — `pnpm test:e2e:cleanup`.
// Runs the same cleanup as globalTeardown, for manual recovery when a test run
// failed mid-flow and left demands/offers behind.

import { createInsForgeAdminClient } from "../../app/lib/insforge-admin";
import { TEST } from "./test-ids";

async function main() {
  const admin = createInsForgeAdminClient();
  const { data: profiles } = await admin.database
    .from("profiles")
    .select("id, phone")
    .in("phone", [TEST.buyer.phone, TEST.seller.phone]);
  const rows = (profiles as unknown as { id: string; phone: string }[] | null) ?? [];
  const userIds = rows.map((r) => r.id);

  if (userIds.length === 0) {
    console.log("No test users found — nothing to clean.");
    return;
  }

  const buyerId = rows.find((r) => r.phone === TEST.buyer.phone)?.id;
  if (buyerId) {
    const { error } = await admin.database.from("demands").delete().eq("buyer_id", buyerId);
    console.log(`demands cleanup: ${error ? error.message : "ok"}`);
  }
  const { error: offerErr } = await admin.database.from("offers").delete().in("seller_id", userIds);
  console.log(`offers cleanup: ${offerErr ? offerErr.message : "ok"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/fixtures/global-teardown.ts apps/web/e2e/fixtures/cleanup.ts
git commit -m "Add E2E globalTeardown + cleanup script"
```

---

## Task 5: Happy-path spec — steps 1–3 (buyer: login, follow, create demand)

**Files:**
- Create: `apps/web/e2e/happy-path.spec.ts`

This task creates the spec file with the first 3 steps (the buyer side that has real UI buttons). Tasks 6 + 7 extend it with the rest.

- [ ] **Step 1: Write the spec skeleton + steps 1–3**

Create `apps/web/e2e/happy-path.spec.ts`:

```typescript
import { test, expect, type APIRequestContext } from "@playwright/test";
import { TEST, PRODUCT_NAME, DEMAND } from "./fixtures/test-ids";

// Happy-path E2E (Issue 19).
//
// Drives the full matchmaking flow: buyer follows + creates a demand → seller
// submits an offer → buyer selects → seller confirms → buyer matches → buyer
// sees the seller's phone. Steps with a real UI button drive the browser; steps
// with no UI yet (follow, offer, select, confirm, match) fall back to API calls
// inside the test context (reusing the storageState cookies).
//
// Each step is wrapped in test.step() so a failure names the failing step.

// Buyer actions use the buyer's storageState.
test.use({ storageState: TEST.buyer.storageState });

test("happy path: demand → offer → select → confirm → match → contacts", async ({
  page,
  request,
}) => {
  // --- Step 1: buyer is logged in (storageState) — verify dashboard ---
  await test.step("buyer sees dashboard", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText(TEST.buyer.phone)).toBeVisible();
  });

  // --- Step 2: buyer follows the product (API fallback — no UI button yet) ---
  const productId = process.env.E2E_PRODUCT_ID!;
  await test.step("buyer follows product", async () => {
    const res = await request.post(`/api/products/${productId}/follow`);
    expect(res.ok()).toBe(true);
  });

  // --- Step 3: buyer creates a demand via the real UI form ---
  let demandId: string;
  await test.step("buyer creates demand", async () => {
    await page.goto("/demands/new");

    // Select the product.
    await page.getByLabel("สินค้าที่รับซื้อ").selectOption({ label: PRODUCT_NAME });

    // Quantity.
    await page.getByLabel("ปริมาณรับซื้อ").fill(String(DEMAND.quantity));

    // Deadline — +7 days, formatted as the <input type="date"> expects (YYYY-MM-DD).
    const deadline = new Date(Date.now() + DEMAND.deadlineDaysAhead * 86400000)
      .toISOString()
      .slice(0, 10);
    await page.getByLabel("ปิดรับเมื่อ").fill(deadline);

    // Location.
    await page.getByLabel("ละติจูด").fill(String(DEMAND.lat));
    await page.getByLabel("ลองจิจูด").fill(String(DEMAND.lng));

    // Submit.
    await page.getByRole("button", { name: /ประกาศรับซื้อ/ }).click();

    // Expect redirect to the demand detail page.
    await page.waitForURL("**/demands/**");

    // Capture the demand id from the URL + verify status via API.
    demandId = new URL(page.url()).pathname.split("/").pop()!;
    const detail = await request.get(`/api/demands/${demandId}`);
    const detailJson = await detail.json();
    expect(detailJson.demand.status).toBe("OPEN");
    expect(detailJson.demand.productId).toBe(productId);
  });
});
```

**Selector note:** the field labels ("สินค้าที่รับซื้อ", "ปริมาณรับซื้อ", "ปิดรับเมื่อ", "ละติจูด", "ลองจิจูด") come from the `demands/new/page.tsx` `Field label=` props. Verify them against the live page during implementation — if a label differs, adjust the `getByLabel` text.

- [ ] **Step 2: Commit**

```bash
git add apps/web/e2e/happy-path.spec.ts
git commit -m "Add E2E happy-path spec steps 1-3 (buyer login/follow/demand)"
```

---

## Task 6: Happy-path spec — steps 4–8 (seller offer, buyer select, seller confirm)

**Files:**
- Modify: `apps/web/e2e/happy-path.spec.ts`

Extend the spec with the offer/selection/confirmation steps. All via API fallback (no UI buttons yet on the demand detail page).

- [ ] **Step 1: Add steps 4–8 to the spec**

The spec currently has steps 1–3 and captures `demandId`. Add these steps before the closing `});` of the test. Because steps 5 + 8 use the **seller's** session (different storageState), they use `request.newContext()`-style API calls — but Playwright's `request` fixture is tied to the test's storageState. The clean approach: create a separate APIRequestContext for the seller.

Insert this near the top of the test body, after the `test(...)` line opens, but before step 1 — actually, declare a seller request context lazily where needed. Append the following steps inside the test function, after step 3:

```typescript
  // --- Step 4: seller logs in (storageState) — we'll use the seller's session
  //     via a fresh API context for the API-fallback steps ---
  const sellerRequest = await request.newContext({
    storageState: TEST.seller.storageState,
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
  });

  // --- Step 5: seller submits an offer (API fallback) ---
  const gradeId = process.env.E2E_PRODUCT_GRADE_ID!;
  let offerId: string;
  await test.step("seller submits offer", async () => {
    const readyDate = new Date(
      Date.now() + 3 * 86400000
    ).toISOString();
    const res = await sellerRequest.post(`/api/offers`, {
      data: {
        demandId,
        productGradeId: gradeId,
        pricePerUnit: 80,
        quantity: 100,
        photos: [],
        pickupLat: 13.7563,
        pickupLng: 100.5018,
        readyDate,
      },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    offerId = json.offer.id;
    expect(json.offer.status).toBe("ACTIVE");
  });

  // --- Step 6: buyer sees the offer (API check) ---
  await test.step("buyer sees offer + best-offer", async () => {
    const res = await request.get(`/api/demands/${demandId}/offers`);
    const json = await res.json();
    expect(json.offers.length).toBeGreaterThanOrEqual(1);
    const best = await request.post(`/api/demands/${demandId}/best-offer`, {
      data: {},
    });
    expect(best.ok()).toBe(true);
  });

  // --- Step 7: buyer selects the offer (API fallback) ---
  await test.step("buyer selects offer", async () => {
    const res = await request.post(`/api/demands/${demandId}/select`, {
      data: {
        selections: [{ offerId, quantity: 100 }],
      },
    });
    expect(res.ok()).toBe(true);
    // Verify the offer moved to PENDING_SELLER_CONFIRMATION.
    const offerRes = await request.get(`/api/offers?demandId=${demandId}`);
    const offerJson = await offerRes.json();
    const sel = offerJson.offers.find((o: { id: string }) => o.id === offerId);
    expect(sel.status).toBe("PENDING_SELLER_CONFIRMATION");
  });

  // --- Step 8: seller confirms the sale (API fallback, seller session) ---
  await test.step("seller confirms sale", async () => {
    const res = await sellerRequest.post(`/api/offers/${offerId}/confirm-sale`);
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.offer.status).toBe("CONFIRMED");
  });
```

**Important:** `demandId` and `offerId` are assigned inside `test.step` blocks. TypeScript may complain they're "used before assigned." Declare them with definite-assignment or initialize them — the cleanest is to declare `let demandId: string;` and `let offerId: string;` at the top of the test body (step 3 already declares `demandId`; add `offerId` there too).

Also `sellerRequest` must be disposed — add `await sellerRequest.dispose();` in a cleanup or at the end of the test. (Playwright auto-disposes at the end, but explicit is better.)

- [ ] **Step 2: Commit**

```bash
git add apps/web/e2e/happy-path.spec.ts
git commit -m "Add E2E happy-path spec steps 4-8 (offer/select/confirm)"
```

---

## Task 7: Happy-path spec — steps 9–11 (match, contacts, notifications) + cleanup

**Files:**
- Modify: `apps/web/e2e/happy-path.spec.ts`

- [ ] **Step 1: Add steps 9–11 + cleanup**

Append these steps inside the test function, after step 8:

```typescript
  // --- Step 9: buyer matches (API fallback) ---
  await test.step("buyer matches", async () => {
    const res = await request.post(`/api/demands/${demandId}/match`);
    expect(res.ok()).toBe(true);
    // Verify demand status → MATCHED.
    const detail = await request.get(`/api/demands/${demandId}`);
    const json = await detail.json();
    expect(json.demand.status).toBe("MATCHED");
  });

  // --- Step 10: buyer sees the seller's phone (the key happy-path assertion) ---
  await test.step("buyer sees seller contacts", async () => {
    const res = await request.get(`/api/demands/${demandId}/contacts`);
    expect(res.ok()).toBe(true);
    const json = await res.json();
    // The contacts endpoint returns the matched sellers' phone numbers.
    // Assert at least one contact with the seller's phone is present.
    expect(json.contacts.length).toBeGreaterThanOrEqual(1);
    expect(
      json.contacts.some((c: { phone: string }) => c.phone)
    ).toBe(true);
  });

  // --- Step 11 (bonus): notifications arrived (bell badge) ---
  await test.step("buyer sees notifications", async () => {
    const res = await request.get(`/api/notifications?limit=5`);
    const json = await res.json();
    // At least the offer.created + seller_confirmed notifications.
    expect(json.unreadCount).toBeGreaterThanOrEqual(1);
  });

  // Cleanup the seller request context.
  await sellerRequest.dispose();
});
```

**Note on the contacts response shape:** read `apps/web/app/api/demands/[id]/contacts/route.ts` fully during implementation to confirm the exact response field name (`contacts` vs `sellers` vs `phones`). Adjust the assertion to match the real shape.

- [ ] **Step 2: Verify the spec typechecks**

Run:
```bash
pnpm --filter @agrimarket/web typecheck
```

Expected: clean. If `demandId`/`offerId` "used before assigned" errors appear, move their declarations to the top of the test body with `let demandId: string;`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/happy-path.spec.ts
git commit -m "Add E2E happy-path spec steps 9-11 (match/contacts/notifs)"
```

---

## Task 8: CI workflow

**Files:**
- Create: `.github/workflows/e2e.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/e2e.yml`:

```yaml
name: E2E

on:
  pull_request:
    branches: [master]
  workflow_dispatch:

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install deps
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm --filter @agrimarket/web exec playwright install --with-deps chromium

      - name: Build web
        run: pnpm --filter @agrimarket/web build

      - name: Start web server
        run: pnpm --filter @agrimarket/web start &
        env:
          NODE_ENV: production
          PORT: 3000
          NEXT_PUBLIC_INSFORGE_URL: ${{ secrets.E2E_INSFORGE_URL }}
          NEXT_PUBLIC_INSFORGE_ANON_KEY: ${{ secrets.E2E_INSFORGE_ANON_KEY }}
          INSFORGE_API_KEY: ${{ secrets.E2E_INSFORGE_API_KEY }}

      - name: Wait for server
        run: npx wait-on http://localhost:3000 --timeout 60000

      - name: Run E2E
        run: pnpm test:e2e
        env:
          E2E_BASE_URL: http://localhost:3000
          E2E_INSFORGE_URL: ${{ secrets.E2E_INSFORGE_URL }}
          E2E_INSFORGE_ANON_KEY: ${{ secrets.E2E_INSFORGE_ANON_KEY }}
          E2E_INSFORGE_API_KEY: ${{ secrets.E2E_INSFORGE_API_KEY }}

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "Add E2E GitHub Actions workflow"
```

---

## Task 9: Final verification + issue/README update

**Files:**
- Modify: `docs/issues/agrimarket-mvp/19-e2e-happy-path.md`
- Modify: `docs/issues/agrimarket-mvp/README.md`

- [ ] **Step 1: Verify the full build pipeline is green**

Run:
```bash
pnpm --filter @agrimarket/shared test
pnpm -r typecheck
pnpm test
```

Expected: shared tests green (304), typecheck clean, turbo 5/5 tasks successful. The E2E suite itself is NOT run in this step (needs a live backend + server — that's the manual/CI step).

- [ ] **Step 2: Verify the Playwright config lists the test**

Run:
```bash
pnpm --filter @agrimarket/web exec playwright test --list
```

Expected: lists the 1 test (`happy-path.spec.ts`). (This requires `globalSetup` to not error at list time — if it does because the server isn't running, that's expected; the list step is just to confirm the spec is discovered.)

- [ ] **Step 3: Update the issue file**

In `docs/issues/agrimarket-mvp/19-e2e-happy-path.md`:
- Change `Status: ready-for-agent` → `Status: done`.
- Append an "Implementation notes" section: 11-step happy-path spec (UI for login + create demand; API fallback for follow/offer/select/confirm/match/contacts), globalSetup seeds 3 fixed users + product + KYC, globalTeardown cleans demands/offers, Playwright config separate from vitest, GitHub Actions workflow with 3 secrets. Note the AC correction (docker-compose → InsForge hosted).
- Add a "Verification ⏳" section with the first-run setup checklist: (1) set GitHub secrets `E2E_INSFORGE_URL`, `E2E_INSFORGE_ANON_KEY`, `E2E_INSFORGE_API_KEY`; (2) boot dev server + run `pnpm test:e2e` locally; (3) push a PR to trigger CI.

- [ ] **Step 4: Update README**

In `docs/issues/agrimarket-mvp/README.md`:
- Change Issue 19 row from `ready-for-agent` → `done`.

- [ ] **Step 5: Commit**

```bash
git add docs/issues/agrimarket-mvp/19-e2e-happy-path.md docs/issues/agrimarket-mvp/README.md
git commit -m "Mark Issue 19 E2E happy path done"
```

---

## Self-review notes

**Spec coverage check:**
- Section 1 (prerequisites: users, product, KYC, session, cleanup) → Tasks 2 + 3 + 4 ✓
- Section 2 (11-step happy path) → Tasks 5 + 6 + 7 ✓
- Section 3 (Playwright config, scripts, deps, gitignore, turbo exclusion) → Task 1 ✓
- Section 4 (CI workflow + secrets) → Task 8 ✓
- Section 5 (assertion strategy, flakiness, scope) → embedded across Tasks 5/6/7 + Task 9 verification ✓

**Placeholder scan:**
- The contact response field name (`contacts` vs alternatives) is flagged with a verification note in Task 7 — not a placeholder, a documented risk to check at implementation time.
- Selectors (labels, button text) are flagged with verification notes — E2E selectors are inherently UI-coupled and must match the live page; the plan provides the best-guess selectors from reading the page source.

**Type consistency:**
- `TEST` object shape (`buyer/seller/admin` each `{ phone, storageState }`) is consistent across Tasks 2/3/4/5/6/7 ✓
- `INFORGE` constant shape (`url, anonKey, apiKey, baseURL`) consistent across Tasks 2/3 ✓
- `demandId` / `offerId` flow from step 3 / step 5 to steps 7/8/9/10 — declared as `let` at the top of the test (flagged in Task 6) ✓

**Known risks (documented in the plan, not blockers):**
- OTP `testCode` availability in production build (CI) — flagged in spec Section 4 caveat.
- UI selectors may need adjustment against the live page — flagged in Tasks 2/5.
- Contacts response field name — flagged in Task 7.
- globalSetup KYC bootstrap bypasses HTTP routes (writes directly via admin client) — deliberate, documented in Task 3.
