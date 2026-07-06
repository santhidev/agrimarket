Status: done

## What to build

Catalog: admin CRUD for products and product grades, plus public browse. `products` (name, category, unit, requires_cold_chain, is_fragile, shelf_life_hours, is_stackable) and `product_grades` (product_id, name, description, sort_order). Some products have no grades → default "มาตรฐาน". Public `GET /api/products` and `GET /api/products/:id/grades`. Admin-only create/update/delete.

## Acceptance criteria

- [x] Admin can create/update/delete a product
- [x] Admin can create/update/delete grades for a product
- [x] Products without grades return a single "มาตรฐาน" grade on read
- [x] `GET /api/products` lists products (public)
- [x] `GET /api/products/:id/grades` lists grades (public)
- [x] Browse page renders products + grades
- [x] Vitest: zod schema validation, grade default, admin gate on writes

## Blocked by

01

## Comments

### Implementation — 2026-07-06

**Schema (migrations `20260706131000`–`20260706136000`):** `products(id uuid PK, name, category, unit default 'กก.', requires_cold_chain, is_fragile, shelf_life_hours nullable, is_stackable, created_at, updated_at)` and `product_grades(id uuid PK, product_id → products on delete cascade, name, description nullable, sort_order, created_at)` with a unique index on `(product_id, name)`. Indexes on `products(category)`, `products(name)`, `product_grades(product_id)`, `product_grades(product_id, sort_order)`. `updated_at` auto-bumps via the built-in `system.update_updated_at()` trigger.

**Migration parser gotcha:** the InsForge SQL parser rejected inline `UNIQUE (...) NULLS NOT DISTINCT` inside `CREATE TABLE` ("Query could not be parsed and was rejected for security reasons"), and `NULLS NOT DISTINCT` was unnecessary anyway because `name` is `CHECK`'d non-empty. The catalog change was split across `20260706131000…20260706136000` to isolate each DDL group while debugging; the header comment on `20260706131000` lists the full set, which must run together as a unit.

**RLS:** catalog is public-read (anyone — anon included) and admin-only writes. The write policies reuse `public.is_current_admin()` from #03 (the recursion-safe `SECURITY DEFINER` helper), so no new gate was needed.

**Shared package (`packages/shared/src/catalog/`):**
- `default-grade.ts` — `DEFAULT_GRADE_NAME = "มาตรฐาน"` and `withDefaultGrade(grades)` (returns the list untouched when non-empty, otherwise `[{ name: "มาตรฐาน" }]`).
- `schemas.ts` — zod `createProductSchema`/`updateProductSchema`/`createGradeSchema`/`updateGradeSchema` (all `.strict()`) + camelCase read shapes `productSchema`/`productGradeSchema`. Defaults (`unit="กก."`, `requiresColdChain=false`, `isFragile=false`, `isStackable=true`, `shelfLifeHours=null`, `sortOrder=0`) are applied at parse time.

**API routes (`apps/web/app/api/`):**
- `GET /api/products` (public, optional `?category=`) and `POST /api/products` (admin).
- `PATCH/DELETE /api/products/:id` (admin).
- `GET /api/products/:id/grades` (public; returns `[{ name: "มาตรฐาน" }]` when empty) and `POST` (admin).
- `PATCH/DELETE /api/product-grades/:id` (admin).
- All writes start with `requireAdmin()` (401 anonymous / 403 non-admin / allow admin), then zod-validate the body (400 on failure). Snake_case DB ↔ camelCase API mapping lives in `apps/web/app/api/catalog/mapping.ts`.

**Bug fix (PostgREST PGRST109):** `UPDATE ... .select().limit(1)` returned `A 'limit' was applied without an explicit 'order'`. Switched PATCH (product + grade) and the no-op re-read paths to `.single()` since `eq("id", …)` already pins one row.

**Browse page:** `/products` (RSC) reads `products` + `product_grades` in parallel, groups grades by `product_id`, applies `withDefaultGrade`, and renders a `ProductCard` grid (no login required). `ProductCard` now renders a 🌱 placeholder when `image` is empty (catalog images aren't part of #04).

**Pre-existing login bug fixed (origin #02):** the login input shows a "+66" prefix but `requestOtpAction`/`verifyOtpAction` forwarded the raw value to `phoneSchema` (`^0\d{8,9}$`) without normalization, so "899999901" (typed per the prefix) was rejected and "0899999901" was treated as malformed. Added `normalizePhone()` in `packages/shared/src/auth/normalize-phone.ts` (canonicalizes `812345678` / `+66812345678` / `66812345678` / dashes-and-spaces → `0812345678`), wired it into both actions, and adjusted the placeholder to `81-234-5678`. 9 new unit tests. This unblocked admin-gate verification for #04 and all downstream admin-only issues (#05, #06, #18).

**Verified end-to-end (dev server + browser fetch + curl):**
- anonymous → all 6 write endpoints → 401 ✓
- non-admin (signed-in `0812345678`) → 4 write endpoints → 403 ✓
- admin (`0899999901`) → POST product/grade 201, PATCH product/grade 200 (incl. no-op + `updated_at` trigger), DELETE product/grade 200 ✓
- admin invalid body (missing name/category, `shelfLifeHours: 0`, unknown field) → 400 ✓
- public GET `/api/products` → 200 with seeded มะม่วง + ข้าวหอมมะลิ ✓
- public GET `/api/products/:id/grades` → 200 (มะม่วง = A/B/C; ข้าว = `[{name:"มาตรฐาน"}]`) ✓
- default grade restored after deleting the last explicit grade ✓
- `/products` renders 2 products with correct categories + grades + default fallback ✓
- `pnpm typecheck` (shared + web) ✓
- `pnpm build` (web, all 4 catalog routes + `/products` listed) ✓
- Vitest: 53 shared + 4 web = 57 tests green ✓

**Notes for downstream issues:**
- Catalog read shapes (`Product`, `ProductGrade`) and write schemas are exported from `@agrimarket/shared`.
- `apps/web/app/api/catalog/mapping.ts` is the canonical place for snake_case ↔ camelCase mapping; reuse it when adding more catalog routes.
- `withDefaultGrade()` must be applied anywhere grades are read for display — it is not stored in the DB.
- Seeded product IDs: `11d0e0e0-0000-4000-8000-000000000001` (มะม่วง, grades A/B/C) and `…0002` (ข้าวหอมมะลิ, no grades).
