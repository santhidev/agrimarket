Status: ready-for-agent

## What to build

Demand core: buyer creates (`POST /api/demands` with product_id, quantity, deadline, buyer_lat, buyer_lng), browses (`GET /api/demands` filter by product/status), views detail (`GET /api/demands/:id` with all its offers). Tracks `pending_quantity` (starts = quantity, drops as offers are PENDING/CONFIRMED, → 0 when MATCHED). Status OPEN. Buyer-only writes.

## Acceptance criteria

- [ ] Buyer can create a Demand (1 product, quantity, deadline, lat/lng)
- [ ] `GET /api/demands` supports filtering by product and status
- [ ] `GET /api/demands/:id` returns the demand + its offers
- [ ] `pending_quantity` initializes to `quantity`
- [ ] Only the buyer owner can modify their demand (write gate)
- [ ] Browse page + detail page render
- [ ] Vitest: create validation (zod), pending_quantity init, owner gate

## Blocked by

03, 04

---

## Implementation notes (2026-07-07)

Done. All acceptance criteria met.

### What shipped

- **Shared package** (`packages/shared/src/demand/`): `DemandStatus` enum, `createDemandSchema` / `demandQuerySchema` / `demandSchema` (zod), `initialPendingQuantity` + `canEditDemand` pure helpers. 25 new unit tests (validation, pending_quantity init, owner gate). Mirrors the kyc domain layout.
- **DB migration** (`20260707125454_create-demands.sql`): `public.demands` table — `product_id` → products (on delete restrict), `buyer_id` → auth.users (cascade), `quantity` / `pending_quantity` (CHECK ≥ 0), lat/lng ranges, deadline, MVP status CHECK list. 4 indexes (browse default, product filter, status filter, "my demands"). RLS: **public read on OPEN** (marketplace browse, sellers see what buyers want before KYC), owner-or-admin on everything else; buyer-only insert (`buyer_id = auth.uid()`); owner-or-admin update.
- **API routes**: `GET /api/demands` (public browse, `?productId` + `?status` filters, joins product name/unit), `POST /api/demands` (auth required, sets `pending_quantity = initialPendingQuantity(quantity)` server-side, buyer_id pinned to session), `GET /api/demands/:id` (returns demand + `offers: []` placeholder for #10). `apps/web/app/api/demands/mapping.ts` holds the snake↔camel mapping + `DEMAND_SELECT` with the nested `product(name, unit)` join.
- **Web pages**: `/demands` (RSC browse — OPEN demands newest first, empty state, CTA routes to `/demands/new` if logged in else `/login`), `/demands/[id]` (RSC detail — full info + offers placeholder, hidden rows 404 via notFound()), `/demands/new` (client form — product select, quantity, datetime-local deadline, lat/lng, POST → redirect to new detail page).

### Decisions worth recording

- **Public browse (OPEN only).** Sellers must see what buyers want before signing up — that's the Demand-driven go-to-market in CONTEXT.md. Non-OPEN demands (MATCHED/COMPLETED/EXPIRED/CANCELLED) are owner-or-admin; RLS hides them from anon callers, and the detail route returns 404 (not 403) so existence is never leaked.
- **`pending_quantity` set at the API, not the DB.** Postgres `DEFAULT` cannot reference another column, so the "pending_quantity initializes to quantity" invariant lives in the shared `initialPendingQuantity` helper (unit-tested) rather than a trigger. The insert route is the single call site.
- **Offers placeholder, not a stub count.** `demandSchema.offers` defaults to `[]`; the detail route returns it empty. The list route never embeds offers. #10 fills the array — the shape is stable.
- **Browse `DemandCard` reuse.** The card's display type (formatted strings) predates the DB shape; the browse page maps DB rows → that type. Image/price/distance are neutral placeholders (a demand has no starting price and distance needs the viewer's lat/lng) — to be wired when offers (#10) and the follow/viewer-distance features land.
- **`demands_select_open_or_owner_or_admin`** is the first policy in the codebase that makes a row public for only one status value. The `status = 'OPEN' OR buyer_id = auth.uid() OR is_current_admin()` shape is the template for any future "public-while-open" market listing.

### Manual verification matrix

- anon `GET /api/demands` → 200 `{"demands":[]}` ✓
- anon `POST /api/demands` → 401 ✓
- anon `GET /api/demands/<bogus-uuid>` → 404 (not 500 — `.single()` null-data-then-error ordering handled) ✓
- seeded OPEN demand via service role → anon browse sees it (RLS public-open policy works) ✓
- seeded MATCHED demand via service role → anon browse does **not** see it (only OPEN leaks); anon `GET /api/demands/<matched-id>` → 404 (existence hidden) ✓
- `pending_quantity == quantity` on the seeded OPEN row (init invariant) ✓
- `?productId=<other>` and `?status=MATCHED` filters return empty when nothing matches ✓
- GET detail returns `offers: []` placeholder ✓
- browse page renders OPEN list + empty state ("ยังไม่มีประกาศรับซื้อ") ✓
- detail page renders, bogus id → Next.js not-found (404) ✓
- create form `/demands/new` renders (client component, loads product list) ✓
- `pnpm --filter @agrimarket/shared test` → 126 passed ✓
- `pnpm --filter @agrimarket/web typecheck` → clean ✓

### Quirks hit (memory for #08)

- **Webpack cache corruption on new `[id]` + client routes** — adding `/demands/[id]` and `/demands/new` triggered the known `Cannot find module './vendor-chunks/tr46@0.0.3.js'` 500 on first hit. Fix: stop dev server, `rm -rf apps/web/.next/cache/webpack`, restart. Recorded in the prior handoff; still applies.
- **`db query` JSON parsing on Windows Git Bash** — `grep -oE` / combined `-e` flags fail ("conflicting matchers"). Piping through `node -e` to parse JSON is the reliable path.
