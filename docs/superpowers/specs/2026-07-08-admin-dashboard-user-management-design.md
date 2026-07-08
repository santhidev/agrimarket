# Issue #18 — Admin Dashboard + User Management

**Date:** 2026-07-08
**Spec for:** `docs/issues/agrimarket-mvp/18-admin-dashboard-user-management.md`
**Status:** Approved (user confirmed 2026-07-08)

## Goal

Admin-only dashboard that surfaces platform-health metrics and lets an admin
search/filter users and set a user's credit tier. The metrics come from the
existing `profiles`, `demands`, and `offers` tables — **no new migration**.

Five endpoints + one page:

| Surface | Method | Path | Existing? |
|---|---|---|---|
| Dashboard metrics | GET | `/api/admin/dashboard` | new |
| User list (search + filter) | GET | `/api/admin/users` | extend |
| Set credit tier | PATCH | `/api/admin/users/:id/credit-tier` | new |
| Dashboard page | — | `/admin` | new |

Pure metric logic (rate calculations) + validation schemas live in
`@agrimarket/shared`, unit-tested in isolation — same two-layer split every
other issue follows.

## What already exists (reuse, don't rebuild)

- **Admin gate.** `requireAdmin()` in `apps/web/app/lib/require-admin.ts` —
  resolves `getCurrentUser()`, returns `{ ok, status }`. Every admin route starts
  with it. `decideAdminGate(user)` is the pure unit already unit-tested.
- **Enums.** `CreditTier` (`None | Bronze | Silver | Gold`) and `KycStatus`
  (`None | Pending | Approved | Rejected`) in
  `packages/shared/src/users/enums.ts`, plus `CREDIT_TIERS` / `KYC_STATUSES`
  arrays. Reused for filter + body validation.
- **User list.** `GET /api/admin/users` already paginates
  (`?page=&pageSize=`), maps snake→camel. Issue 18 adds `search`, `kycStatus`,
  `tier` on top of it.
- **Profiles table + indexes.** `profiles_is_admin_idx`, `profiles_kyc_status_idx`
  already exist — no new index needed. `tier` has no index; that's fine, the
  users table is small and paginated.
- **Demand/offer status enums.** `DemandStatus` (OPEN/MATCHED/COMPLETED/EXPIRED/
  CANCELLED) drives the metric counts.
- **Design system.** `Card`, `Badge`, `Input`, `Button`, `Avatar`, `TopNav`,
  `Footer` in `apps/web/app/components/`. Reuse for the page chrome.

## Metric definitions

PRD lists the five metrics but does not define formulas. The user approved these
definitions (they map onto the data the MVP tables hold):

```
totalUsers         = count(profiles)
totalDemands       = count(demands)
fulfillmentRate    = (MATCHED + COMPLETED) / totalDemands
transactionSuccess = (MATCHED + COMPLETED) / (MATCHED + COMPLETED + EXPIRED + CANCELLED)
repeatRate         = buyersWith2PlusDemands / totalBuyers
```

Rationale:

- **Fulfillment rate** measures "of every demand, how many reached a deal" — the
  top-of-funnel health. OPEN demands haven't resolved yet, so they stay in the
  denominator but not the numerator.
- **Transaction success** measures "of demands that finished, how many closed
  well." Only terminal statuses count; OPEN and MATCHED are excluded (MATCHED
  hasn't self-pickuped yet, so it's not a closed transaction).
- **Repeat rate** measures buyer retention — buyers who posted 2+ demands / all
  distinct buyers. A buyer = a distinct `buyer_id` in `demands`.

Edge cases (encoded in the pure functions):

- Zero denominator → `0` (never `NaN` or `Infinity`). On a fresh DB every rate
  is `0`, not a divide-by-zero error.
- Returns the rate as a number in `[0, 1]`. The page formats it as a percent.

## Pure logic — `@agrimarket/shared`

### `packages/shared/src/admin/metrics.ts` (new)

```ts
export interface DemandCounts {
  open: number;
  matched: number;
  completed: number;
  expired: number;
  cancelled: number;
}

export function computeFulfillmentRate(c: DemandCounts): number;
// (matched + completed) / total. total = sum of all five. 0 if total = 0.

export function computeTransactionSuccess(c: DemandCounts): number;
// (matched + completed) / (matched + completed + expired + cancelled).
// 0 if that denominator = 0.

export function computeRepeatRate(totalBuyers: number, buyersWith2Plus: number): number;
// buyersWith2Plus / totalBuyers. 0 if totalBuyers = 0.
```

Co-located `metrics.test.ts` — boundary (0 denom → 0), exact-boundary (1/2/3 at
the thresholds), negative-input clamp (treats negative counts as 0, defensive),
and a full-DemandCounts round-trip. ~14 tests.

### `packages/shared/src/admin/schemas.ts` (new)

```ts
export const userFilterSchema = z.object({
  search: z.string().trim().optional(),        // phone substring (ilike)
  kycStatus: z.enum(KYC_STATUSES).optional(),   // import from users/enums
  tier: z.enum(CREDIT_TIERS).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
}).strict();

export const setCreditTierSchema = z.object({
  tier: z.enum(CREDIT_TIERS),
}).strict();
```

Co-located `schemas.test.ts` — valid passes, unknown kycStatus/tier rejected,
`page` coerce-from-string, defaults applied. ~8 tests.

Both exported from `packages/shared/src/index.ts`.

## API routes

### `apps/web/app/api/admin/dashboard/route.ts` (new)

`GET`, admin gate → SSR client counts (via the shared `loadAdminDashboard()` —
see "Shared data loader" below; the route is a thin handler around it):

1. `profiles` total — `select('id', { count: 'exact' }).limit(0)` (the
   `limit(0)` keeps the row payload empty; `count` in the response is the
   number).
2. `demands` per-status — five filtered count queries
   (`status`-`eq`-X, `count: 'exact'`, `limit(0)`). PostgREST has no GROUP BY,
   and the demands set is small, so five cheap counts beat loading rows.
3. Repeat rate — select `buyer_id` from all demands (no limit, no count), then
   in JS build a `Map<buyerId, count>`; `totalBuyers = map.size`,
   `buyersWith2Plus = [...map.values()].filter(n => n >= 2).length`.
   PostgREST has no `COUNT(DISTINCT)`.

Counts feed the pure functions; response:

```json
{
  "totalUsers": 123,
  "totalDemands": 45,
  "fulfillmentRate": 0.42,
  "transactionSuccess": 0.71,
  "repeatRate": 0.18,
  "demandCounts": { "open": 10, "matched": 5, "completed": 12, "expired": 6, "cancelled": 12 }
}
```

`demandCounts` ships alongside the rates so the page can show the raw breakdown
without a second call.

### `apps/web/app/api/admin/users/route.ts` (extend)

Parse query with `userFilterSchema`; on invalid → 400. Build the query:

- `search` present → `.ilike('phone', `%${search}%`)`.
- `kycStatus` present → `.eq('kyc_status', kycStatus)`.
- `tier` present → `.eq('tier', tier)`.
- Pagination unchanged (`range(from, to)`), `select(..., { count: 'exact' })`
  so the response carries `total` for the page's pager.

Response adds `total` (the count) so the client can render "Showing 1–50 of 312".

### `apps/web/app/api/admin/users/[id]/credit-tier/route.ts` (new)

`PATCH`. Gate chain: admin gate (401/403) → load target profile via SSR
`.maybeSingle()` (404 if null, existence-leak-safe) → validate body with
`setCreditTierSchema` (400) → UPDATE via the **admin client**, not SSR.

**Why the admin client.** The `profiles_update_own` RLS policy has
`with check (id = auth.uid())` and no admin clause (confirmed in
`20260701051003_create-profiles.sql`). An admin updating another user's row
through the SSR client fails that `with check` — the admin's `auth.uid()` is
their own id, not the target's. The migration comment says tier changes are
"admin-only via the service client", and `createInsForgeAdminClient()` (from
Issue 09) is exactly that. The admin gate already authenticated + authorized
the caller, so bypassing RLS for this single UPDATE is the sanctioned path.

Response: the updated profile row (camelCase), 200. This reads back through the
SSR client (RLS-visible to the admin) so the page sees the fresh tier.

## Shared data loader

Both the `/admin` Server Component and the `/api/admin/dashboard` route need the
same metric snapshot. To avoid duplicating the count queries, extract them into
one loader:

`apps/web/app/api/admin/dashboard/load-dashboard.ts` (new):

```ts
export async function loadAdminDashboard(): Promise<AdminDashboardSnapshot> {
  // ...the 7 count queries + Map for repeat rate + pure-fn rates
}
export interface AdminDashboardSnapshot { /* the JSON shape above */ }
```

- The route's `GET()` calls it and returns `NextResponse.json(snapshot)`.
- The Server Component calls it directly (no HTTP round-trip).

This mirrors how Issue 15's contacts logic was shared between the route and its
readers — a loader, not duplicated query code.

## `/admin` page

`apps/web/app/admin/page.tsx` — **Server Component**.

- `getCurrentUser()` → null or non-admin → `redirect("/dashboard")`.
- Calls `loadAdminDashboard()` directly (shared loader — no HTTP round-trip).
- Layout: `TopNav` (admin badge) → metric grid (5 `Card`s, lucide icons, rate
  as `Math.round(rate * 100) + '%'`) → `<UsersTable />` (client island).

`apps/web/app/admin/UsersTable.tsx` — **Client Component** (`'use client'`).

- Reads search params from the URL (`useSearchParams`), fetches
  `/api/admin/users?...` on filter change, renders the table + pager.
- Filter row: `Input` (phone search) + two `<select>` (kycStatus, tier).
- Per-row "Set tier" — a `<select>` that PATCHes
  `/api/admin/users/:id/credit-tier` and refetches the list on success.
- Error/loading states rendered inline (no toast lib in the repo).

## RLS check (no migration needed)

| Operation | Client | Policy | OK? |
|---|---|---|---|
| Dashboard counts (profiles, demands) | SSR | `profiles_select_own_or_admin`, `demands_select_open_or_owner_or_admin` | ✅ admin sees all |
| Users list | SSR | `profiles_select_own_or_admin` | ✅ |
| Set credit tier | **admin** | bypasses RLS | ✅ (gate is the boundary) |
| Read-back after PATCH | SSR | `profiles_select_own_or_admin` | ✅ |

No new policies, no new migration. The `is_current_admin()` SECURITY DEFINER
already exists and backs every admin policy.

## Testing

- **Vitest (`@agrimarket/shared`):** `metrics.test.ts` (~14) + `schemas.test.ts`
  (~8). Covers zero-denom, exact boundaries, coerce, unknown enum, defaults.
  Run: `pnpm --filter @agrimarket/shared test`.
- **Admin gate:** already covered by `decideAdminGate` tests (Issue 03). The
  new routes reuse `requireAdmin()` unchanged, so no new gate tests.
- **Live verify (deferred, manual):** curl the three endpoints with an admin
  session cookie — 401 anon, 403 non-admin, 200 admin with the JSON shape above;
  confirm filter narrows the list; confirm PATCH flips `tier` and a non-admin
  PATCH gets 403.

## Files

```
packages/shared/src/admin/metrics.ts         (new, pure logic)
packages/shared/src/admin/metrics.test.ts    (new)
packages/shared/src/admin/schemas.ts         (new, zod)
packages/shared/src/admin/schemas.test.ts    (new)
packages/shared/src/index.ts                 (+export admin/*)

apps/web/app/api/admin/dashboard/route.ts                 (new)
apps/web/app/api/admin/dashboard/load-dashboard.ts        (new, shared loader)
apps/web/app/api/admin/users/route.ts                     (extend: search/filter + total)
apps/web/app/api/admin/users/[id]/credit-tier/route.ts    (new)

apps/web/app/admin/page.tsx                 (new, Server Component)
apps/web/app/admin/UsersTable.tsx           (new, Client Component)
```

No migration, no storage bucket, no cron schedule.

## Out of scope

- Offers-side metrics (offer acceptance rate, seller activity). The PRD lists
  only the five metrics above; offers enter the picture only if a future metric
  needs them. Issue 18 computes from `profiles` + `demands` only.
- Editable roles (`is_admin`, `is_rider`, `is_hub_staff`) — acceptance is tier
  only. Role toggling is a later admin concern.
- Time-series / charts — the dashboard is a single snapshot.
- Per-user detail page — the users table is the management surface.
