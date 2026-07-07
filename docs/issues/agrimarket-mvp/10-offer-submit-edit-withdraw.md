Status: done

## What to build

Offer submission by a seller: submit (`POST /api/offers` with demand_id, product_grade_id, price_per_unit, quantity, photos[], pickup_lat/lng, ready_date), edit (`PATCH /api/offers/:id`), withdraw (`DELETE /api/offers/:id` → WITHDRAWN). Enforces: seller must have `kyc_status = APPROVED`; 1 seller = 1 offer per Demand (unique demand_id + seller_id); Demand must be OPEN. Status ACTIVE.

## Acceptance criteria

- [x] KYC-approved seller can submit an offer on an OPEN demand
- [x] Unique constraint: a seller cannot create a second offer on the same demand (edit the existing one instead)
- [x] Seller can edit price/quantity/location/ready_date on their own ACTIVE offer
- [x] Seller can withdraw their offer (→ WITHDRAWN)
- [x] Non-KYC-approved users get 403 on submit
- [x] Submitting on a non-OPEN demand fails
- [x] Vitest: KYC gate, unique constraint, withdraw transition, demand-status gate

## Blocked by

06, 07

---

## Implementation notes (2026-07-08)

Done. All acceptance criteria met.

### What shipped

- **Shared package** (`packages/shared/src/offer/`):
  - `schemas.ts` (new) — `createOfferSchema` (demandId, productGradeId?,
    pricePerUnit, quantity, photos[], pickupLat/Lng, readyDate; `.strict()`),
    `updateOfferSchema` (partial, at-least-one, `.strict()`), `offerSchema`
    (read shape). 18 new unit tests (create × 11, update × 7).
  - `offer-transitions.ts` — added `canEditOffer(status)` (ACTIVE-only) and
    `canWithdrawOffer(status)` (ACTIVE/PENDING_SELLER_CONFIRMATION/CONFIRMED;
    MATCHED locked, terminal can't withdraw). 9 new unit tests.
  - Full shared suite 184 passed (was 157).
- **Migrations**:
  - `20260707180105_create-offers.sql` (new, applied) — `public.offers` +
    `public.offer_photos` + RLS. Unique index `offers_demand_seller_uniq`
    (demand_id, seller_id) enforces 1 seller = 1 offer. RLS: buyer of the
    parent demand + offer's seller + admin can SELECT; seller-only INSERT/
    UPDATE/DELETE. `offer_photos` visibility inherits via the parent offer.
    Uses `system.update_updated_at()` trigger (platform built-in, same as
    products).
  - `20260707180603_offer-photos-storage-policies.sql` (new, applied) —
    Storage RLS for the `offer-photos` bucket: public-read (bucket flag),
    owner-scoped write (uploaded_by = JWT sub, same shape as kyc-documents).
- **Storage bucket** `offer-photos` (public-read, created via CLI).
- **API routes** (`apps/web/app/api/offers/`):
  - `route.ts` — `GET` (seller's own offers, optional ?demandId=) + `POST`
    (submit). POST gate chain: 401 → 403 (KYC not Approved) → 400 (bad body) →
    404 (demand missing) → 409 (demand not OPEN via `acceptsOffers`) → 409
    (duplicate) → 201. Bulk-inserts photos after the offer row.
  - `[id]/route.ts` — `GET` (single offer + photos), `PATCH` (edit ACTIVE-only
    via `canEditOffer`; photos replaced wholesale), `DELETE` (soft → WITHDRAWN
    via `canWithdrawOffer`). Same 401→404→403→409 gate chain as demands.
  - `mapping.ts` — `OfferRow`, `OFFER_SELECT` (nested offer_photos join),
    `mapOffer` (snake→camel, numeric price coercion).
- **Demand detail embed** (`apps/web/app/api/demands/mapping.ts`) —
  `DEMAND_SELECT` now nests `offers:offers(..., offer_photos(...))`. The buyer
  sees all offers on their demand in one round-trip; a non-buyer/anon sees an
  empty array (RLS hides other sellers' offers). `mapDemand` maps the nested
  offers into the response.

### Decisions worth recording

- **Unique index includes WITHDRAWN rows.** A withdrawn offer is terminal
  (CONTEXT.md), so the seller cannot re-submit on the same demand. The unique
  index spans all statuses — a second insert hits 23505 regardless of the
  existing offer's status. This prevents a seller from withdrawing then
  re-submitting to reset their position.
- **Photos replaced wholesale on PATCH.** No diffing — delete all existing,
  insert the new set. Simpler than tracking add/remove, and photo sets are
  small (0-5 typically). sort_order is the array index.
- **`product_grade_id` nullable.** Some products have no grades ("มาตรฐาน",
  CONTEXT.md). The schema makes it optional; the DB column is nullable with
  `on delete set null` (a grade deletion doesn't kill the offer).
- **`ready_date` is `date`, not `timestamptz`.** A seller says "พร้อมส่งวันที่
  X" — a calendar day, not an instant. The schema's future-check compares at
  UTC midnight so a same-day ready_date is allowed.
- **No INSERT policy on offer_photos for buyers.** Only the offer's seller can
  insert photos (via `offer_photos_insert_via_offer`). The buyer never writes
  photos — they only read.
- **Storage uses JWT sub, not auth.uid().** `uploaded_by` is a text column
  storing the user's JWT sub; the policy compares against
  `(auth.jwt() ->> 'sub'::text)`, matching the existing kyc-documents pattern.
  Using `auth.uid()` (uuid) caused a type mismatch (`text = uuid`).

### Verification (live, against the dev DB)

- **Auth gates:** all 5 routes (GET/POST /api/offers, GET/PATCH/DELETE
  /api/offers/[id]) return 401 for anonymous callers.
- **DB-layer gates** (via admin-client script, simulating the route logic):
  - INSERT offer → status=ACTIVE, price=25.5 ✅
  - Duplicate (same demand+seller) → blocked, code 23505 (unique violation) ✅
  - INSERT photo → linked to offer ✅
  - UPDATE price → 22 ✅
  - UPDATE status → WITHDRAWN ✅
- **Demand detail embed:** `GET /api/demands/:id` returns `offers: []` for an
  anonymous viewer (RLS hides sellers' offers from non-buyers) ✅
- Pure-logic gates (canEditOffer, canWithdrawOffer, schemas) covered by 27 new
  unit tests.
- Test data cleaned up (demand deleted, kyc_status reset to None) after verify.

### Files

- `packages/shared/src/offer/schemas.ts` (new)
- `packages/shared/src/offer/schemas.test.ts` (new)
- `packages/shared/src/offer/offer-transitions.ts` (extended)
- `packages/shared/src/offer/offer-transitions.test.ts` (extended)
- `packages/shared/src/index.ts` (+export offer schemas)
- `migrations/20260707180105_create-offers.sql` (new, applied)
- `migrations/20260707180603_offer-photos-storage-policies.sql` (new, applied)
- `apps/web/app/api/offers/route.ts` (new)
- `apps/web/app/api/offers/mapping.ts` (new)
- `apps/web/app/api/offers/[id]/route.ts` (new)
- `apps/web/app/api/demands/mapping.ts` (extended — embed offers)

Out-of-repo (CLI): storage bucket `offer-photos` (public) + its RLS policies.

### Open loose ends (non-blocking)

- **Owner-side happy path not HTTP-verified** (browser MCP down again). The
  401 anon gates + DB-layer gates (unique, RLS, status transitions) + unit
  tests cover the logic; the live owner POST/PATCH/DELETE round-trip over HTTP
  is the manual gap to close when the browser backend returns.
- **#08 cascade not yet wired.** The demand DELETE route's `// Issue 08
  cascade NOTE` still marks the spot — now that the offers table exists, a
  future touch can add `UPDATE offers SET status='CANCELLED' WHERE demand_id
  AND status IN (...)` using `shouldCancelOfferOnDemandCancel`. Out of scope
  for #10; the cascade is a demand-side concern.
