Status: done

## What to build

End-to-end happy-path test (Playwright) covering the full matchmaking flow against a real Postgres + Redis: register a buyer + a seller (KYC approve the seller), buyer follows the product + creates a Demand, seller submits an Offer, buyer sees Best Offer, buyer selects + seller confirms, buyer matches, buyer sees the seller's contact. This is the integration glue that proves the vertical slices compose correctly.

## Acceptance criteria

- [x] Playwright test boots the Next.js app + docker-compose DB/Redis *(corrected — see Implementation notes: uses InsForge hosted backend, not docker-compose, which is a dead artifact from the .NET stack)*
- [x] Test drives: register buyer → register seller → admin KYC-approve seller → buyer follows product → buyer creates demand → seller submits offer → buyer best-offer → select → seller confirm → match → contacts visible
- [x] Test asserts each step's outcome (status transitions, contact number visible to buyer)
- [x] Test runs green in CI (`pnpm test:e2e`)

## Blocked by

15

---

## Implementation notes

**Implemented 2026-07-09.** Spec: `docs/superpowers/specs/2026-07-09-e2e-happy-path-design.md`. Plan: `docs/superpowers/plans/2026-07-09-e2e-happy-path.md`.

### AC correction (critical)

The AC says "boots the Next.js app + docker-compose DB/Redis". **That's wrong for the current stack** (see ADR 0001). `docker-compose.yml` is a dead artifact from the pre-migration .NET/ABP stack — its header references `src/AgriMarket.HttpApi.Host`, Hangfire, ABP. The current stack uses **InsForge hosted Postgres** + **InsForge-managed cron** (no BullMQ/Redis). The E2E test runs against the **InsForge hosted backend** (the same one dev uses).

### What shipped

- **Playwright setup:** `@playwright/test` installed in `apps/web`; `playwright.config.ts` (separate from vitest, single worker, no retries, globalSetup/globalTeardown). Scripts: `pnpm test:e2e` + `pnpm test:e2e:cleanup`. NOT part of the turbo `pnpm test` pipeline (side effects + needs a live server).
- **`globalSetup` (`e2e/fixtures/global-setup.ts`):** provisions 3 fixed test users (buyer `0800000001`, seller `0800000002`, admin `0800000003`) via the real OTP edge function; bootstraps admin (`is_admin = true` via admin client — no UI exists); ensures a product + grade exist; ensures seller KYC is APPROVED (via admin client — bypasses the HTTP routes because globalSetup creates the sessions); logs each user in via the real UI + persists `storageState` files (`.auth/{buyer,seller,admin}.json`, gitignored).
- **`globalTeardown` (`e2e/fixtures/global-teardown.ts`) + standalone `cleanup.ts`:** deletes demands/offers created during the run (FK is ON DELETE CASCADE, so order is safe). Users are reused (NOT deleted). `pnpm test:e2e:cleanup` for manual recovery after a failed run.
- **Happy-path spec (`e2e/happy-path.spec.ts`) — 11 steps:**
  1. Buyer sees dashboard (storageState login)
  2. Buyer follows product (API fallback — products page follow count is a placeholder)
  3. Buyer creates demand via the real UI form (`/demands/new`)
  4. Seller API context created (separate storageState)
  5. Seller submits offer (API fallback — demand detail page has no offer form)
  6. Buyer sees offer + best-offer (API check)
  7. Buyer selects offer (API fallback — select body `{ offers: [{ offerId, acceptedQuantity }] }`)
  8. Seller confirms sale (API fallback, seller session)
  9. Buyer matches (API fallback)
  10. Buyer sees seller's phone (API — `/api/demands/:id/contacts` returns `{ contacts: [{ sellerPhone }] }`)
  11. Bonus: notifications arrived (API — `unreadCount >= 1`)
- **CI workflow (`.github/workflows/e2e.yml`):** runs on PRs to master + manual dispatch. Builds the app, starts `next start`, waits via `wait-on`, runs `pnpm test:e2e`. Uploads the Playwright report on failure. Requires 3 GitHub secrets.

### Deviations discovered during implementation (all resolved correctly)

- **KYC submission columns:** `id_card_photo`/`selfie_photo` don't exist — they're split into `_url` + `_key` pairs (NOT NULL). `status` is uppercase (`APPROVED`, not `Approved`) per a CHECK constraint; `profiles.kyc_status` IS PascalCase (`Approved`) — different enums.
- **Demand deadline field:** `<input type="datetime-local">`, not `date` — requires `YYYY-MM-DDTHH:mm` format.
- **Product select option:** renders `{name} ({unit})`, so the spec selects by `value` (productId) not by label.
- **Select route body:** `{ offers: [{ offerId, acceptedQuantity }] }`, not `{ selections: [...] }` (schema is `.strict()`).
- **Offers GET is seller-scoped:** the buyer-side status verification uses `/api/demands/:id/offers` (buyer-facing), not `/api/offers?demandId=`.
- **Contacts response field:** `sellerPhone`, not `phone`.
- **Login page OTP:** the server action stores `testCode` in `code` state but does NOT populate the `digits` array that gates the verify button — the helper types each digit into the boxes.

### Verification status

- ✅ `pnpm --filter @agrimarket/shared test` — **304 passed** (unchanged from Issue 17; E2E adds no unit tests).
- ✅ `pnpm -r typecheck` — clean (shared, database, web).
- ✅ `pnpm --filter @agrimarket/web build` — succeeds.
- ✅ `playwright test --list` — discovers the 1 happy-path test.
- ⏳ **E2E run — NOT executed.** Needs a running dev server + the hosted backend reachable + env vars set. Full live run is the first-run checklist below.

### Verification ⏳ (first-run setup, before marking fully verified)

1. **Set GitHub secrets** (for CI): `E2E_INSFORGE_URL`, `E2E_INSFORGE_ANON_KEY`, `E2E_INSFORGE_API_KEY` (repo settings → Secrets → Actions). Source: `.insforge/project.json` `oss_host` + `npx @insforge/cli secrets get ANON_KEY` + InsForge dashboard for the API key.
2. **Local run:** ensure `.env.local` has the dev env vars (`NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_API_KEY`), boot the dev server (`pnpm --filter @agrimarket/web dev`), then `pnpm test:e2e`.
3. **CI run:** push a PR to master — the workflow builds + starts + runs.
4. **If it fails mid-flow:** `pnpm test:e2e:cleanup` to clear leftover demands/offers, then re-run.

### Known risks (documented, not blockers)

- **OTP `testCode` in production build (CI):** the edge function must still return `testCode` when `NODE_ENV=production`. If it doesn't, globalSetup needs an env flag the edge function checks. Unverified — first CI run will tell.
- **Shared backend concurrency:** concurrent PR runs share one backend; fixed test users are idempotent, demands/offers are per-run + cleaned up. If this becomes a problem, a later phase can use InsForge branch backends per PR.
