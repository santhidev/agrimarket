Status: done

## What to build

Product suggestions: any user can suggest a new product (`POST /api/product-suggestions`), admin reviews (`GET /api/admin/product-suggestions/pending`, `POST /api/admin/product-suggestions/:id/approve|reject`). On approve, a `product` is created from the suggestion. Status: PENDING / APPROVED / REJECTED with optional rejection_reason.

## Acceptance criteria

- [x] Any authenticated user can submit a product suggestion
- [x] Admin can list pending suggestions
- [x] Admin can approve (creates a product) or reject (with reason)
- [x] User can see the status of their own suggestions
- [x] Vitest: suggestion lifecycle (submit → pending → approve creates product; reject stores reason)

## Blocked by

04

## Comments

### Implementation — 2026-07-06

**Schema (migration `20260706174236_product-suggestions`):** `product_suggestions(id uuid PK, requester_id → auth.users on delete cascade, name, category, unit default 'กก.', status default 'PENDING' CHECK in PENDING/APPROVED/REJECTED, rejection_reason nullable, reviewed_by → auth.users on delete set null, submitted_at default now(), reviewed_at nullable)`. Indexes on `(status)`, `(requester_id)`, and `(status, submitted_at)` for the admin FIFO review queue. Single migration (no parser gotchas this round — `NULLS NOT DISTINCT` was avoided as in #04).

**RLS:** owner-scoped + admin. SELECT is `requester_id = auth.uid() OR public.is_current_admin()`; INSERT is `requester_id = auth.uid()` (anonymous blocked — no `auth.uid()`); UPDATE is admin-only via `public.is_current_admin()`. No DELETE policy — suggestions are immutable history. Reuses the recursion-safe `is_current_admin()` SECURITY DEFINER helper from #03; no new gate.

**Shared package (`packages/shared/src/catalog/suggestion-schemas.ts`):**
- `SuggestionStatus` const-enum object (`Pending`/`Approved`/`Rejected` → DB string values) + type.
- `createProductSuggestionSchema` (`.strict()`, reuses #04 `name`/`category` rules, `unit` default `"กก."`).
- `rejectProductSuggestionSchema` — `{ rejectionReason: nonEmpty }` (mandatory reason so the requester is told why).
- `productSuggestionSchema` — camelCase read shape.
- `buildProductFromSuggestion(row)` — the testable core of "approve creates a product": maps a suggestion → snake_case `products` insert payload applying catalog defaults (`requires_cold_chain=false`, `is_fragile=false`, `shelf_life_hours=null`, `is_stackable=true`). `unit` is optional on the input so it accepts a raw body before zod defaults it.

**API routes (`apps/web/app/api/`):**
- `POST /api/product-suggestions` (auth, 401 anon) — inserts pinned to the current user; 400 on invalid body.
- `GET /api/product-suggestions` (auth) — current user's own suggestions, newest first (RLS enforces ownership at the DB).
- `GET /api/admin/product-suggestions/pending` (admin) — `status='PENDING'`, ordered `submitted_at` asc (oldest first).
- `POST /api/admin/product-suggestions/:id/approve` (admin) — loads the row first to distinguish 404 (missing) from 409 (already reviewed); creates a `products` row via `buildProductFromSuggestion`; flips the suggestion to APPROVED with `reviewed_by` + `reviewed_at`; returns `{ suggestion, product }`.
- `POST /api/admin/product-suggestions/:id/reject` (admin) — validates `rejectionReason` (400 if missing); 409 if not PENDING; sets status REJECTED + `rejection_reason` + reviewer/timestamp.
- Mapping (`mapSuggestion` + `ProductSuggestionRow` + `SUGGESTION_SELECT`) added to the shared `apps/web/app/api/catalog/mapping.ts`.

**Verified end-to-end (dev server + browser fetch, port 3001):**
- anonymous → all 5 endpoints → 401 ✓
- non-admin → 3 admin endpoints → 403 ✓
- non-admin → `GET /api/product-suggestions` → 200, count 0 (admin's suggestions hidden by RLS — ownership isolation proven) ✓
- non-admin submit → 201, `requester_id` pinned to caller ✓
- admin submit → 201 (PENDING) → `GET pending` lists it → approve → 200 with new product (catalog defaults correct) + suggestion APPROVED+reviewer+timestamp → second approve → 409 ✓
- admin reject without reason → 400; reject with Thai reason → 200 (REJECTED, reason persisted); reject again → 409 ✓
- approved product surfaced in `GET /api/products` (public catalog) ✓
- admin `GET /api/product-suggestions` → 2 own suggestions; pending queue → 0 after review ✓
- invalid submit (missing category) → 400 ✓
- `pnpm typecheck` (shared + web) ✓
- `pnpm build` (web — all 4 new routes listed) ✓
- Vitest: 72 shared + 4 web = 76 tests green ✓

**Notes for downstream issues:**
- Suggestion read shape (`ProductSuggestion`) and write schemas exported from `@agrimarket/shared`.
- Approved suggestions create a real catalog product — Demand/Offer issues (#07+) can reference it by the returned product `id` like any seeded product.
- Suggestions UI page(s) are deferred (acceptance criteria are API-only); a `/product-suggestions` user page and an admin review queue page can land with #18 (admin dashboard).
- Test data was cleaned (suggestions → 0, catalog back to 2 seeded products) so the dev DB is in its seeded state.
