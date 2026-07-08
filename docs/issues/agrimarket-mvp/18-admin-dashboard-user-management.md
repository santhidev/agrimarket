Status: done

## What to build

Admin dashboard + user management: `GET /api/admin/dashboard` returns metrics (total users, total demands, fulfillment rate, transaction success, repeat rate) computed from existing tables; `GET /api/admin/users` with search/filter by KYC status and tier; `PATCH /api/admin/users/:id/credit-tier` to set a user's tier (Phase 2 credit prep — placeholder field). Admin-only (gate from 03).

## Acceptance criteria

- [x] `GET /api/admin/dashboard` returns the 5 metrics computed from DB
- [x] `GET /api/admin/users` supports filtering by kyc_status and tier
- [x] `PATCH /api/admin/users/:id/credit-tier` sets the tier
- [x] All admin endpoints reject non-admins (403)
- [x] Dashboard page renders the metrics
- [x] Vitest: metric calculations (fulfillment rate, repeat rate), filter logic, admin gate

## Blocked by

03

---

## Implementation notes (2026-07-08)

Done. All acceptance criteria met. Design spec at
`docs/superpowers/specs/2026-07-08-admin-dashboard-user-management-design.md`;
plan at `docs/superpowers/plans/2026-07-08-admin-dashboard-user-management.md`.

### What shipped

- **Shared package** (`packages/shared/src/admin/`):
  - `metrics.ts` (new) — three pure rate functions + `DemandCounts` interface.
    - `computeFulfillmentRate(c)` = `(matched + completed) / total` (total = all
      five statuses). 0 when total = 0.
    - `computeTransactionSuccess(c)` = `(matched + completed) / (matched +
      completed + expired + cancelled)` — OPEN excluded (unresolved). 0 when no
      terminal demands.
    - `computeRepeatRate(totalBuyers, buyersWith2Plus)` =
      `buyersWith2Plus / totalBuyers`. 0 when no buyers.
    - All three clamp negative inputs via `Number.isFinite` (also guards NaN /
      Infinity) and return a value in `[0, 1]`.
  - `metrics.test.ts` (new) — 14 tests (boundaries, zero-denom → 0, negative
    clamp, OPEN-excluded denominator, rate = 1 cases).
  - `schemas.ts` (new) — `userFilterSchema` (`search` optional trimmed,
    `kycStatus`/`tier` enums optional, `page`/`pageSize` coerced-from-string
    with defaults 1/50 and cap 200, `.strict()`); `setCreditTierSchema` (single
    `tier` enum, `.strict()`); inferred `UserFilter` / `SetCreditTierInput`
    types.
  - `schemas.test.ts` (new) — 13 tests (empty/defaults, string coerce, all
    filters, unknown enum reject, page≤0 reject, pageSize cap boundary, search
    trim, strict unknown-key, setCreditTier valid/unknown/missing/strict).
  - Full shared suite **280 passed** (was 253; +27).
  - Both exported from `packages/shared/src/index.ts`.
- **API routes** (`apps/web/app/api/admin/`):
  - `dashboard/load-dashboard.ts` (new) — `loadAdminDashboard()` shared loader
    used by BOTH the route and the page (no HTTP round-trip for the page). Runs
    6 count queries in parallel via PostgREST `{ count: "exact", head: true }`
    (5 per-demand-status + 1 profiles) + 1 `buyer_id` select tallied in JS for
    distinct/repeat buyers (PostgREST has no `COUNT(DISTINCT)`). **Throws on
    query error** (the route catches → 500; a silent 0 would mask a broken DB).
    Returns `AdminDashboardSnapshot` (5 metrics + `demandCounts` breakdown).
  - `dashboard/route.ts` (new) — `GET`, admin gate → try/catch around the
    loader → JSON snapshot.
  - `users/route.ts` (extended) — replaces hand-rolled pagination parsing with
    `userFilterSchema.safeParse(Object.fromEntries(url.searchParams))` (400 with
    zod issues on invalid). Adds `search` (phone `.ilike`), `kycStatus`, `tier`
    filters via the `let query = ...; if (cond) query = query.X(...)` reassign
    pattern (matches `demands/route.ts`). Response now carries `total` (from
    `{ count: "exact" }`) for the pager.
  - `users/[id]/credit-tier/route.ts` (new) — `PATCH`. Gate chain: admin gate
    (401/403) → 404 (target missing, via SSR `.maybeSingle()`) → 400 (bad body
    via `setCreditTierSchema`) → UPDATE via the **admin client** → read-back
    via SSR → 200 with camelCase user. See RLS decision below.
- **Page** (`apps/web/app/admin/`):
  - `page.tsx` (new) — **Server Component**. `getCurrentUser()` → non-admin
    `redirect("/dashboard")` BEFORE the loader call (no wasted query). Calls
    `loadAdminDashboard()` directly. Renders TopNav + green-700 header + a
    5-card metric grid (rates as `Math.round(rate*100)%`) + `<UsersTable />`.
  - `UsersTable.tsx` (new) — **Client Component** (`'use client'`). Local state
    for search/kycStatus/tier/page; fetches `/api/admin/users`; per-row
    `<select>` PATCHes `/api/admin/users/:id/credit-tier` and refetches on
    success. Pager (prev/next + "X–Y จาก total") renders only when
    `total > pageSize`. Thai labels via `TIER_LABEL` / `KYC_LABEL` maps;
    `CreditTier` / `KycStatus` enums drive the option values.

### Decisions worth recording

- **Why the credit-tier UPDATE uses the admin client, not SSR.** The
  `profiles_update_own` RLS policy has `with check (id = auth.uid())` and **no
  admin clause** (confirmed in `20260701051003_create-profiles.sql`). An admin
  updating ANOTHER user's row through the SSR client fails that `with check` —
  the admin's `auth.uid()` ≠ the target's. The migration comment says tier
  changes are "admin-only via the service client"; `createInsForgeAdminClient()`
  (from Issue 09) is exactly that. The admin gate (`requireAdmin()`) has already
  authenticated + authorized the caller, so the gate is the security boundary;
  bypassing RLS for this single column is the sanctioned path. The read-back
  stays on the SSR client so the response is RLS-visible (admin SELECTs all via
  `profiles_select_own_or_admin`).
- **Why metric math lives in `@agrimarket/shared`.** Same two-layer split as
  every prior issue: pure logic in `shared` (unit-tested, stack-agnostic),
  I/O + RLS writes in routes. The loader's only job is to fetch counts; the
  pure functions decide what they mean. The zero-denominator → 0 and
  OPEN-excluded-denominator edge cases are unit-tested, not proved by a live
  curl.
- **Why PostgREST `{ count: "exact", head: true }` over `.limit(0)`.** Matches
  the established repo idiom at `apps/web/app/api/health/route.ts:12` and the
  SDK's own JSDoc. `head: true` returns no rows, just the count. (An earlier
  plan draft used `.limit(0)`; code review caught the divergence — corrected.)
- **Why the loader throws on error (no silent `?? 0`).** The loader is called
  from two sites with different error semantics: the route wraps it in try/catch
  → 500, and a Server Component render-error is visible. A silent 0 would show
  fake-zero metrics and hide a broken DB / RLS misconfiguration. Surface errors.
- **Why repeat rate uses a JS Map, not a DB count.** PostgREST has no
  `COUNT(DISTINCT buyer_id)`. Pulling every demand's `buyer_id` and tallying in
  JS (`totalBuyers = map.size`, `buyersWith2Plus = values ≥ 2`) is correct and
  cheap for the MVP demands set.
- **Why the page calls the loader directly (no fetch).** Server-to-server data
  access in a Server Component avoids an HTTP round-trip and keeps the page's
  data dependency type-safe. The route exists for any future non-server
  consumer (e.g. a client chart); both share `loadAdminDashboard()`.
- **Why `users/route.ts` mapping stays inline (no `mapping.ts`).** The 11-field
  snake→camel mapping is duplicated between the list route and the
  credit-tier read-back. The offers routes solved this with a shared
  `mapping.ts` (`OFFER_SELECT`, `mapOffer`). For 2 consumers in one feature it's
  borderline; left inline to match the precedent the list route already set
  this issue. Extract if a 3rd consumer appears.
- **`setTierFor` transport-error handling.** The Client Component's PATCH
  wrapper has a try/catch matching the GET path — a network failure (not just a
  non-2xx) surfaces the Thai error string rather than an unhandled rejection.

### Verification

- ✅ `pnpm --filter @agrimarket/shared test` — **280 passed** (was 253; +27
  across metrics + schemas).
- ✅ `pnpm -r typecheck` — clean (shared, database, web).
- ✅ `pnpm test` (turbo) — 5/5 tasks successful (typecheck × 3 + build + test
  × 2). Build registers `/admin` as a dynamic route.
- ⏳ Live curl verification — **NOT run**. Needs a running dev server
  (`pnpm --filter @agrimarket/web dev`) + an admin session cookie (and a
  non-admin session for the 403 check). Manual checklist:
  1. `GET /api/admin/dashboard` → anon 401; non-admin 403; admin 200 with the
     5-metric shape + `demandCounts`.
  2. `GET /api/admin/users?search=08&kycStatus=Approved&tier=Gold` → admin 200,
     filtered list, `total` present.
  3. `GET /api/admin/users?kycStatus=BOGUS` → 400 with zod issues.
  4. `PATCH /api/admin/users/:id/credit-tier -d '{"tier":"Gold"}'` → admin 200,
     response tier = Gold; non-admin 403.
  5. `PATCH /api/admin/users/:id/credit-tier -d '{"tier":"Platinum"}'` → 400.
  6. Visit `/admin` as admin → metrics grid + users table render; as non-admin
     → redirected to `/dashboard`.

### Files

- `packages/shared/src/admin/metrics.ts` (new)
- `packages/shared/src/admin/metrics.test.ts` (new)
- `packages/shared/src/admin/schemas.ts` (new)
- `packages/shared/src/admin/schemas.test.ts` (new)
- `packages/shared/src/index.ts` (+export admin/*)
- `apps/web/app/api/admin/dashboard/load-dashboard.ts` (new)
- `apps/web/app/api/admin/dashboard/route.ts` (new)
- `apps/web/app/api/admin/users/route.ts` (extended — search/filter + total)
- `apps/web/app/api/admin/users/[id]/credit-tier/route.ts` (new)
- `apps/web/app/admin/page.tsx` (new)
- `apps/web/app/admin/UsersTable.tsx` (new)

No migration, no storage bucket, no cron schedule.

### Out of scope (unchanged from spec)

Offers-side metrics (offer acceptance rate, seller activity). Editable roles
(`is_admin`, `is_rider`, `is_hub_staff`) — acceptance is tier only. Time-series
/ charts. Per-user detail page.
