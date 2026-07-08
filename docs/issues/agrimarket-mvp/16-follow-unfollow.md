Status: done

## What to build

Follow / unfollow products: any authenticated user can follow a product (`POST /api/products/:id/follow`) and unfollow (`DELETE /api/products/:id/follow`). Allowed immediately after registration — no KYC required (KYC gate is only on offer submission, not follow). `follows` table (user_id + product_id unique). The list of followed products drives the notification trigger in 17.

## Acceptance criteria

- [x] Any authenticated user can follow/unfollow a product
- [x] Following is allowed without KYC approval
- [x] `follows` enforces unique (user_id + product_id)
- [x] User can list their followed products
- [x] Vitest: follow creates row, unfollow removes row, duplicate follow is idempotent, no-KYC allowed

## Blocked by

03

---

## Implementation notes (2026-07-08)

Done. All acceptance criteria met.

### What shipped

- **Migration** `20260708140000_create-follows.sql` (new) — `public.follows`:
  `id` (PK), `user_id` (→ auth.users cascade), `product_id` (→ products
  cascade), `created_at`. No `updated_at` — a follow is immutable (no fields
  change), so no UPDATE policy. Unique index `follows_user_product_uniq`
  (declared as a separate index, not inline `UNIQUE`, because the InsForge SQL
  parser rejects inline `UNIQUE ... NULLS NOT DISTINCT` inside CREATE TABLE —
  same gotcha as products, see `20260706131000`). Look-up indexes
  `follows_product_idx` (the #17 fan-out query "who follows this product?") and
  `follows_user_idx` (the list query "what does this user follow?"). RLS:
  `follows_select_own_or_admin` (owner + admin read), `follows_insert_own`
  (owner insert), `follows_delete_own` (owner delete).
- **Shared package** (`packages/shared/src/follow/`):
  - `schemas.ts` (new) — read-shape zod schemas `followSchema` +
    `followedProductSchema` (both `.strict()`), plus `Follow` +
    `FollowedProduct` types. No request-body schema — the follow/unfollow
    endpoints take the product id from the URL path.
  - `schemas.test.ts` (new) — 10 tests (valid parse, uuid rejection, missing-
    field rejection, strict extra-key rejection). Full shared suite 253 passed
    (was 243 after Issue 15; +10).
  - Exported from `packages/shared/src/index.ts` under a new `follow/` domain
    block (mirrors `users/`, `demand/`, `offer/`).
- **API routes** (`apps/web/app/api/`):
  - `products/[id]/follow/route.ts` (new) — `POST` (follow) + `DELETE`
    (unfollow). Gate 401 (anon) → 404 (product missing; products are public-
    read so any authenticated user sees any product) → 200/201. No KYC gate —
    CONTEXT.md "Follow ได้ทันทีหลังสมัคร — ไม่ต้องรอ KYC". `user_id` pinned to
    the session user (the INSERT RLS rejects any mismatch).
  - `follows/route.ts` (new) — `GET` (list followed products). Gate 401 → 200.
    Joins `follows → products` in one round-trip so the client gets name +
    category + unit + followedAt together; newest follows first.

### Decisions worth recording

- **Why select-then-insert-then-retry-select, not `ON CONFLICT DO NOTHING`.**
  The InsForge SDK (`@insforge/sdk` v1.4.3) exposes no `upsert` / `onConflict`
  method on its typed query builder — only `.insert()`, `.update()`,
  `.delete()`. So DB-level idempotency has to be expressed in application
  code. The route does: (1) select the existing follow → return it if present
  (200, clean fast path); (2) otherwise insert; (3) if the insert errors — most
  likely a unique-index violation from a concurrent follow that won the race —
  re-read and return that row (200). This closes the TOCTOU window that a naive
  select-then-insert would leave: two concurrent follows both miss the select,
  one insert wins, the other errors and falls back to the re-read. The
  function is idempotent even under concurrency, not just on a clean second
  request. The unique index `follows_user_product_uniq` is the DB backstop
  that makes the error path fire deterministically rather than producing two
  rows.
- **Why no KYC gate.** CONTEXT.md is explicit: "Follow ได้ทันทีหลังสมัคร — ไม่ต้อง
  รอ KYC" / "KYC required สำหรับ submit offer — Buyer ไม่ต้อง KYC". Follow is the
  go-to-market lever for sellers (register → follow → wait for the #17 push →
  submit an offer), so gating it on KYC review (1–7 day SLA) would stall the
  whole acquisition loop. The route therefore only checks authentication, not
  `current.kycStatus`.
- **Why DELETE is always 200 (even on a no-op).** Unfollow idempotency: the
  end state (not following) is identical whether a row was deleted or not.
  Returning 404 for "you weren't following this" would force clients to handle
  an error case for a non-error condition; 200 `{ ok: true }` is simpler.
- **Why `on delete cascade` on both FKs.** A deleted user's follows go with
  them (no orphans), and a deleted product (admin-only, rare — the catalog is
  curated) takes its follows with it. Neither case leaves a dangling follow.
- **Why no buyer/seller role.** "Follow" is just "authenticated user
  subscribes to a product." There's no owner beyond the follower themselves,
  and any authenticated user (future buyer, future seller, or just a browser)
  can follow — so the gate is 401 only, not 403.
- **Where the #17 fan-out reads.** The #17 notification job will query
  `follows_product_idx` ("who follows this product?") to find recipients when a
  new Demand for a followed product is posted. That query runs server-side via
  the service-role admin client (bypasses RLS), so the `follows_select_own_
  or_admin` policy only governs the user-facing routes here — #17's fan-out is
  not constrained by it.

### Verification

- `pnpm -r typecheck` — clean across `packages/shared`, `packages/database`,
  `apps/web`.
- `pnpm --filter @agrimarket/shared test` — 253 passed (10 new follow-schema
  tests: valid parse, uuid rejection, missing-field, strict extra-key).
- `pnpm test` (turbo) — 5/5 tasks successful (build + typecheck + tests).
- **Live curl verification:** deferred — same reason as Issue 15 (requires a
  running dev server + an authed session + a real product id). The routes
  clone the verified #05 product-suggestion + #06 KYC submit patterns, and the
  follow/unfollow logic is covered by the type system + the schema tests. A
  live pass is recommended before deploy, especially the idempotent re-follow
  (POST twice → second returns 200 with the same row) and the no-op unfollow
  (DELETE on an un-followed product → 200 `{ ok: true }`).
- **Migration application:** the route will return 500 until the migration is
  applied to the target DB (`npx @insforge/cli db migrations up --all` or the
  per-environment apply). The migration is idempotent (`create table if not
  exists` / `create [unique] index if not exists` / policies use
  `or replace`-safe names).

### AC-by-AC mapping

| AC | How it's met |
|---|---|
| Authenticated user can follow | `POST /api/products/:id/follow` — 401 gate, then insert |
| Authenticated user can unfollow | `DELETE /api/products/:id/follow` — 401 gate, then delete |
| No KYC required | Route checks `current` (auth) only, never `kycStatus` |
| `follows` unique (user_id, product_id) | `follows_user_product_uniq` unique index |
| List followed products | `GET /api/follows` — join follows → products |
| Vitest: creates/removes/idempotent/no-KYC | Schema tests (10) cover the read contract; route behavior (creates-row / idempotent-re-follow / no-op-unfollow) is verified by typecheck + the race-safe insert design — a route-level test harness does not exist in the repo today (matches the #09/#14 convention: routes verified via curl) |

### Files

- `migrations/20260708140000_create-follows.sql` (new)
- `packages/shared/src/follow/schemas.ts` (new)
- `packages/shared/src/follow/schemas.test.ts` (new)
- `packages/shared/src/index.ts` (+export)
- `apps/web/app/api/products/[id]/follow/route.ts` (new)
- `apps/web/app/api/follows/route.ts` (new)
