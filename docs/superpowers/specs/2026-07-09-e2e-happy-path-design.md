# Issue 19 — E2E: Happy Path — Design

**Date:** 2026-07-09
**Status:** Design (awaiting plan)
**Issue:** `docs/issues/agrimarket-mvp/19-e2e-happy-path.md`

## Goal

A Playwright E2E test that drives the full AgriMarket matchmaking happy path through the browser UI against the real InsForge hosted backend, proving the vertical slices (auth → KYC → demand → offer → select → confirm → match → contacts) compose correctly end-to-end. The test runs locally via `pnpm test:e2e` and in CI via a GitHub Actions workflow.

## Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Test target backend | InsForge hosted (the same backend dev uses; NOT docker-compose — that file is a dead artifact from the .NET stack) |
| Drive mechanism | UI via Playwright (true E2E, per the AC) — API fallback only for steps with no UI button yet |
| Data isolation | Fixed test users (buyer/seller/admin) seeded once + reused; demands/offers cleaned up per run |
| CI scope | Local-ready + full GitHub Actions workflow with documented secrets |
| Test structure | Single happy-path spec + `globalSetup`/`globalTeardown` + `storageState` for session reuse |

## Stack reality (critical context)

The issue's AC says "Playwright test boots the Next.js app + docker-compose DB/Redis". **That is wrong for the current stack** and this design corrects it:

- **No local docker Postgres/Redis.** `docker-compose.yml` is a dead artifact from the pre-migration .NET/ABP stack (its header comment references `src/AgriMarket.HttpApi.Host`, Hangfire, ABP — see ADR 0001). The current stack uses **InsForge hosted Postgres** + **InsForge-managed cron** (no BullMQ/Redis).
- **No Prisma, no NextAuth.** DB access via `@insforge/sdk`; auth via InsForge phone-OTP edge function; session via `@insforge/sdk/ssr` cookies. (Established divergence — see the Issue 17/18 handoffs.)
- **No Playwright installed yet.** This issue adds it.
- **OTP test hook:** the `phone-otp` edge function returns a `testCode` in the `requestOtpAction` response (dev mode). E2E uses this to log in without mocking.

## Current state (what already exists)

- **All API routes** for the happy path exist: auth (OTP via edge function), KYC submit + admin approve, demands CRUD, offers CRUD, select, confirm-sale/decline-sale, match, contacts, best-offer, follow/unfollow, notifications.
- **All UI pages** exist: `/login`, `/dashboard`, `/products`, `/demands`, `/demands/new`, `/demands/[id]`, `/d/[id]` (share page), `/profile`, `/admin`, `/notifications`.
- **`TopNav`** renders on authenticated pages with a `userId` prop (Issue 17).
- **No CI config** (`.github/workflows/` doesn't exist).
- **`wait-on`** is not a dependency (added in this issue).

## Section 1 — Prerequisites + test data model

### Fixed test users (3)

Created via the real OTP flow in `globalSetup` (identical to a real user — through the `phone-otp` edge function):

| Role | Phone | KYC | is_admin | Purpose |
|---|---|---|---|---|
| Buyer | `0800000001` | None (not required) | false | Creates the demand, selects, matches |
| Seller | `0800000002` | **Approved** (admin approves in setup) | false | Follows product, submits offer, confirms sale |
| Admin | `0800000003` | None | **true** (set via DB) | Approves seller's KYC |

**Admin bootstrap:** there's no UI to grant `is_admin`. `globalSetup` uses the service-role admin client to `UPDATE profiles SET is_admin = true` for the admin user after creation — the Issue 03 bootstrap pattern.

### Product + grade

E2E needs a product to create a demand against. `globalSetup`:
1. Queries for an existing product (e.g. "มะม่วง"). If one exists, reuse it.
2. If none, creates one via the admin client (seed data).
3. Queries the product's grades; stores `productId` + `gradeId` for the test.

### KYC submission + approval

The seller must be KYC-Approved before submitting an offer. In `globalSetup`:
1. Seller submits KYC via `POST /api/kyc`.
2. Admin approves via `POST /api/admin/kyc/:id/approve`.

(Both are prerequisites, not assertions — the happy path itself starts after these.)

### Cleanup strategy

`globalTeardown` runs after the test completes:
1. Deletes test demands + offers created during this run (scoped by the buyer's/seller's user ids).
2. **Does NOT delete users** — they're fixed and reused every run (reduces setup time; doesn't accumulate users).
3. If the test fails mid-flow, teardown may not run → a standalone cleanup script `pnpm test:e2e:cleanup` is provided for manual recovery.

### Session persistence

`globalSetup` logs in all 3 users through the real UI (entering the OTP = `testCode`), then persists each session as a `storageState` file:
- `.auth/buyer.json`
- `.auth/seller.json`
- `.auth/admin.json`

The test spec loads these via `test.use({ storageState })` to reuse sessions without re-logging-in per step. These files are gitignored.

## Section 2 — Happy path flow (11 steps)

The single spec drives this flow; each step is a `test.step()` for debuggability:

| # | Step | Actor | Mechanism | Assertion |
|---|---|---|---|---|
| 1 | Login buyer | Buyer | UI: `/login` → phone → OTP | sees dashboard + own phone |
| 2 | Follow product | Buyer | UI: `/products` → click follow | follow indicator / count |
| 3 | Create demand | Buyer | UI: `/demands/new` → product + qty + deadline (+7d) + location | demand appears in `/demands`, status OPEN |
| 4 | Login seller | Seller | UI: `/login` (new context) | sees dashboard |
| 5 | Submit offer | Seller | UI: `/demands/:id` → price + qty + grade + location + ready date | offer appears, status ACTIVE |
| 6 | Buyer sees offer + best offer | Buyer | UI: `/demands/:id` | sees seller's offer + best-offer combination |
| 7 | Select offer | Buyer | UI: `/demands/:id` → select offer + qty | offer → PENDING_SELLER_CONFIRMATION |
| 8 | Seller confirms sale | Seller | UI → confirm button | offer → CONFIRMED |
| 9 | Buyer matches | Buyer | UI → confirm self-pickup | demand → MATCHED |
| 10 | Buyer sees contacts | Buyer | UI: `/demands/:id` | **sees seller's phone number** (via `/api/demands/:id/contacts`) |
| 11 | Notifications (bonus) | Buyer | UI: bell badge | sees notification from earlier steps (offer.created, seller_confirmed) |

### Edge cases / complexity

1. **OTP `testCode` retrieval:** the UI flow goes through a server action, so Playwright can't see the `testCode` directly. `globalSetup` calls the edge function directly (`client.functions.invoke("phone-otp", ...)`) to request the OTP and capture `testCode`, then types it into the UI. The test spec itself uses `storageState` (already logged in) and doesn't re-enter OTP.

2. **KYC + admin approve live in `globalSetup`**, not the spec — they're prerequisites, not the happy path under test.

3. **UI may not have a button for every action yet** (select, confirm-sale, match may be API-only at this stage). Where a UI button is missing, the test **falls back to an API call** (`await request.post(...)`) inside the Playwright test — the call still runs in the browser context and reuses the `storageState` cookies. The implementation will check each page and fall back per-step as needed.

4. **Deadline:** the demand deadline must be in the future (cron auto-expires every 5 min). Set it to +7 days so it can't expire mid-test.

## Section 3 — Playwright config + scripts + package structure

### File layout

```
apps/web/
├── e2e/
│   ├── happy-path.spec.ts          (single spec — 11 steps)
│   ├── fixtures/
│   │   ├── global-setup.ts         (seed users, product, KYC, storageState)
│   │   ├── global-teardown.ts      (cleanup demands/offers)
│   │   ├── cleanup.ts              (standalone manual cleanup script)
│   │   └── test-ids.ts             (fixed phones, product name, constants)
│   └── helpers/
│       └── flow.ts                 (shared UI helpers: login, navigate)
├── playwright.config.ts            (E2E config — separate from vitest)
├── vitest.config.ts                (existing unit config — unchanged)
└── .auth/                          (storageState files — gitignored)
    ├── buyer.json
    ├── seller.json
    └── admin.json
```

### Playwright config

`apps/web/playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,           // single happy path — no parallelism
  retries: 0,                      // flake must be fixed, not retried
  workers: 1,                      // shared backend state
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/fixtures/global-setup.ts",
  globalTeardown: "./e2e/fixtures/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // No webServer auto-start — globalSetup verifies the server is up.
});
```

### Scripts

`apps/web/package.json` adds:
```json
"test:e2e": "playwright test",
"test:e2e:cleanup": "tsx e2e/fixtures/cleanup.ts"
```

Root `package.json` adds:
```json
"test:e2e": "pnpm --filter @agrimarket/web test:e2e"
```

### Dependencies

`apps/web` devDependencies add:
```json
"@playwright/test": "^1.49.0"
```

(`wait-on` is invoked via `npx wait-on` in the CI workflow, so it doesn't need to be a project dependency — npx fetches it on demand. Local runs don't need it; `globalSetup` polls the server with a simple retry loop instead.)

### .gitignore additions

```
# E2E (Issue 19)
.auth/
apps/web/test-results/
apps/web/playwright-report/
```

### Turbo pipeline

`test:e2e` is **NOT** added to the turbo pipeline. It needs a running server + hosted backend + has side effects (not cacheable). `pnpm test` (turbo) stays typecheck + build + unit test. E2E runs only via explicit `pnpm test:e2e`.

## Section 4 — CI (GitHub Actions)

### Workflow: `.github/workflows/e2e.yml`

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
      - run: pnpm install --frozen-lockfile
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

### Required secrets (documented in the issue file, not committed)

| Secret | Use | Source |
|---|---|---|
| `E2E_INSFORGE_URL` | hosted backend URL | `.insforge/project.json` `oss_host` |
| `E2E_INSFORGE_ANON_KEY` | anon key | `npx @insforge/cli secrets get ANON_KEY` |
| `E2E_INSFORGE_API_KEY` | service-role (cleanup + admin bootstrap) | InsForge dashboard |

### Caveats

1. **E2E uses a production build (`next start`) in CI**, not the dev server — faster, closer to prod. `globalSetup` still reaches the edge function for OTP `testCode` (it's a backend feature, not a Next.js dev feature).
2. **All PR runs share one backend** — concurrent PRs may conflict on test data. Mitigation: fixed test users are idempotent; demands/offers are created + cleaned up per run. If this becomes a real problem, a later phase can use InsForge branch backends per PR (out of scope).
3. **OTP `testCode` in production build:** must verify the edge function still returns `testCode` when `NODE_ENV=production`. If not, `globalSetup` needs an env flag (e.g. `E2E_TEST_MODE=1`) the edge function checks. This is a risk to verify during implementation.

## Section 5 — Assertion strategy + error handling

### Assertion depth per step

Every step asserts an outcome, not just "didn't crash":

| Level | What | Example |
|---|---|---|
| **Critical** (every step) | status / state changed correctly | demand OPEN, offer CONFIRMED, demand MATCHED |
| **Critical** (step 10) | the key data appears | **seller's phone number visible** |
| **Standard** | UI feedback | toast / status badge / list update |
| **Bonus** (step 11) | notification arrived | bell badge has unread |

### Assertion mechanism

- **UI-visible state:** assert via DOM (`await expect(locator).toContainText(...)` / `toBeVisible()`) — status badge, phone number, notification count.
- **State not shown in UI:** fall back to an API call (`await request.get(...)`) to verify the real DB state — demand status, offer status. Uses Playwright's `request` fixture (reuses `storageState` cookies).
- **Combination:** assert both UI + API where possible — UI proves the user sees the result, API proves the backend state is correct.

### Failure handling

- `screenshot: "only-on-failure"` + `trace: "on-first-retry"` — Playwright captures screenshot + trace on failure, uploaded as a CI artifact (Section 4).
- `retries: 0` — flake must be fixed, not retried. The happy path must be deterministic.
- Each step wrapped in `await test.step("description", async () => { ... })` so the failure message names which step failed.
- Local debug: `PWDEBUG=1 pnpm test:e2e` opens the Playwright Inspector (step-through, pause, DOM inspector).

### Flakiness risks + mitigations

| Risk | Mitigation |
|---|---|
| Realtime (notification) async | step 11 uses `expect.poll` or `waitFor` with a 5s timeout — don't assert immediately |
| Cron auto-expire (5 min) | demand deadline +7 days — safe from auto-expire mid-test |
| Background jobs (auto-decline 24h) | not in play — test finishes in minutes |
| InsForge hosted latency | generous timeouts (Playwright default 30s/action) |
| Stale test data from a prior failed run | `globalSetup` checks + cleans up before seeding |

### Out of scope

- **Negative paths** (401/403/409/400) — covered by unit tests in `@agrimarket/shared` + Issue 17 integration tests. E2E covers the happy path only.
- **Counter-offer flow** — a side feature (Issue 12), off the main happy path. If time allows, a second spec `e2e/counter-offer.spec.ts`, but not an AC.
- **Admin dashboard** (Issue 18) — not part of the matchmaking happy path.
- **Mobile/responsive** — desktop chromium only.

## Out of scope (beyond this issue)

- **InsForge branch backends per PR** — a later phase if shared-backend concurrency becomes a problem.
- **Cross-browser testing** (Firefox/Safari) — chromium only for MVP.
- **Visual regression testing** — not part of happy-path verification.
- **Load/performance testing** — separate concern.
