# Issue #10 — Offer Submit + Edit + Withdraw

**Date:** 2026-07-08
**Spec for:** `docs/issues/agrimarket-mvp/10-offer-submit-edit-withdraw.md`
**Status:** Approved (user confirmed 2026-07-08)

## Goal

A KYC-approved seller can submit an offer on an OPEN demand, edit their own
ACTIVE offer's price/quantity/grade/location/ready_date/photos, and withdraw
their offer (→ WITHDRAWN). Enforces: KYC-approved gate, 1 seller = 1 offer per
demand (unique), demand must be OPEN to accept new offers.

## Data model

### `public.offers` (new migration)

```sql
create table public.offers (
  id                uuid primary key default gen_random_uuid(),
  demand_id         uuid not null references public.demands(id) on delete cascade,
  seller_id         uuid not null references auth.users(id) on delete cascade,
  product_grade_id  uuid null references public.product_grades(id) on delete set null,
  price_per_unit    numeric(12,2) not null check (price_per_unit > 0),
  quantity          integer not null check (quantity > 0),
  accepted_quantity integer null check (accepted_quantity >= 0),
  status            text not null default 'ACTIVE'
                      check (status in ('ACTIVE','PENDING_SELLER_CONFIRMATION',
                                        'CONFIRMED','MATCHED','WITHDRAWN','REJECTED',
                                        'EXPIRED','CANCELLED','DECLINED')),
  pickup_lat        double precision not null check (pickup_lat between -90 and 90),
  pickup_lng        double precision not null check (pickup_lng between -180 and 180),
  ready_date        date not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 1 seller = 1 offer per demand (Issue 10 acceptance). A second insert by the
-- same seller on the same demand hits this unique index → route returns 409
-- "edit the existing one instead".
create unique index offers_demand_seller_uniq
  on public.offers (demand_id, seller_id);
create index offers_demand_idx on public.offers (demand_id, status);
create index offers_seller_idx on public.offers (seller_id, status);
```

- `product_grade_id` nullable — some products have no grades ("มาตรฐาน"),
  per CONTEXT.md. Seller may omit it.
- `accepted_quantity` nullable — set later when buyer selects (#11). Null until
  then; the offer's offered quantity is `quantity`.
- `ready_date` is `date` (not timestamptz) — a day, not an instant. Seller says
  "พร้อมส่งวันที่ X", not "พร้อมส่งเวลา 14:32".

### `public.offer_photos` (sub-table, mirrors KYC url+key pattern)

```sql
create table public.offer_photos (
  id          uuid primary key default gen_random_uuid(),
  offer_id    uuid not null references public.offers(id) on delete cascade,
  url         text not null,
  key         text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index offer_photos_offer_idx on public.offer_photos (offer_id, sort_order);
```

- Client uploads photos to Storage `offer-photos` bucket first, then POSTs the
  resulting `url`+`key` pairs in the offer body (same flow as KYC #06).
- `sort_order` preserves the seller's chosen photo order on the demand detail
  page.
- On offer UPDATE, photos are replaced wholesale (delete old + insert new) so
  the route doesn't diff partial arrays.

### RLS

`offers`:
- **SELECT**: the demand's buyer, the offer's seller, or admin. A buyer sees
  all offers on their demand; a seller sees only their own offers; anon sees
  nothing (offers are not public — only the OPEN demand list is).
- **INSERT**: seller only, `seller_id = auth.uid()`.
- **UPDATE**: seller only, `seller_id = auth.uid()`.
- **DELETE**: seller only (the route does a soft WITHDRAWN, not a hard delete,
  but the DELETE policy covers the hard-delete path for completeness).

`offer_photos`:
- **SELECT**: anyone who can SELECT the parent offer (join through offer_id).
- **INSERT/DELETE**: the offer's seller (`offer_id` → offers.seller_id =
  auth.uid()).

## Storage bucket `offer-photos`

New public bucket via CLI. Public read (offer photos appear in the demand
detail page the buyer views), seller-scoped write (owner uploads, RLS pins
object ownership). Created with:

```bash
npx @insforge/cli storage buckets create offer-photos --public
```

Plus an RLS policy on `storage.objects` restricting writes to the object's
owner (seller can upload only to their own paths).

## Shared package (TDD)

### `packages/shared/src/offer/schemas.ts` (new)

- `createOfferSchema` — `{ demandId, productGradeId?, pricePerUnit, quantity,
  photos[], pickupLat, pickupLng, readyDate }`. `.strict()`. price > 0,
  quantity int > 0, readyDate today-or-future, photos is an array of
  `{ url, key }` (0+ items).
- `updateOfferSchema` — partial: any of `{ productGradeId, pricePerUnit,
  quantity, photos, pickupLat, pickupLng, readyDate }`. `.strict()`. All
  optional; at least one field required (non-empty).
- `offerSchema` — read shape (camelCase) for API response.

### `packages/shared/src/offer/offer-transitions.ts` (extend)

- `canEditOffer(status)` — true only for ACTIVE. Once the offer enters the
  handshake (PENDING_SELLER_CONFIRMATION) or any terminal state, fields are
  locked.
- `canWithdrawOffer(status)` — true for ACTIVE/PENDING_SELLER_CONFIRMATION/
  CONFIRMED. A MATCHED offer is locked (the deal is done); terminal statuses
  can't withdraw (they already ended).

## API routes

### `POST /api/offers` (new)

Gate chain: 401 (no session) → 403 (KYC not Approved) → 400 (bad body) →
409 (demand not OPEN, via `acceptsOffers(demand.status)`) → 409 (duplicate:
seller already has an offer on this demand) → 201.

Flow:
1. `getCurrentUser()` → 401 if null.
2. `current.kycStatus !== Approved` → 403 "ต้องยืนยันตัวตนก่อน".
3. Parse body via `createOfferSchema` → 400 if invalid.
4. Load demand → `acceptsOffers(demand.status)` → 409 if not OPEN.
5. Check unique: `SELECT id FROM offers WHERE demand_id=? AND seller_id=?` →
   if exists, 409 "คุณมี offer บน demand นี้แล้ว แก้ไข offer ที่มีอยู่".
6. INSERT offer (status=ACTIVE) + bulk INSERT offer_photos.
7. Return 201 with mapped offer (including photos).

### `GET /api/offers/[id]` (new)

401 → 404 (missing/not visible under RLS) → 200. Returns the offer with its
photos inlined.

### `PATCH /api/offers/[id]` (new)

401 → 404 → 403 (not seller) → 409 (not ACTIVE via `canEditOffer`) → 400 (bad
body / empty) → 200. Updates only the editable fields; photos replaced
wholesale if present in the body.

### `DELETE /api/offers/[id]` (new)

Soft-withdraw: 401 → 404 → 403 → 409 (not withdrawable via
`canWithdrawOffer`) → 200 (status → WITHDRAWN). No hard delete — the row
stays for history + the unique constraint (so the seller can't re-submit on
the same demand; they'd edit the withdrawn offer back... actually no — a
WITHDRAWN offer is terminal, the seller cannot re-enter. This matches
CONTEXT.md: WITHDRAWN is terminal).

### Demand detail embed

`GET /api/demands/[id]` currently returns `offers: []` placeholder. Issue 10
inlines the demand's offers via PostgREST nested select
(`offers:offers(id, ..., offer_photos(...))`) so the buyer sees all offers on
their demand in one round-trip. The select runs under the buyer's RLS, so a
non-buyer sees an empty list (offers are buyer-or-seller visible, not public).

## Test matrix (vitest, pure logic)

`canEditOffer`: ACTIVE → true; PENDING_SELLER_CONFIRMATION/CONFIRMED/MATCHED/
WITHDRAWN/REJECTED/EXPIRED/CANCELLED/DECLINED → false.

`canWithdrawOffer`: ACTIVE/PENDING_SELLER_CONFIRMATION/CONFIRMED → true;
MATCHED/WITHDRAWN/REJECTED/EXPIRED/CANCELLED/DECLINED → false.

`createOfferSchema`: valid body passes; missing required fields fail;
pricePerUnit ≤ 0 fails; quantity ≤ 0 fails; readyDate in past fails;
photos missing url or key fails; unknown field fails (.strict).

`updateOfferSchema`: partial update passes; empty body fails (at least one
field); unknown field fails (.strict); pricePerUnit ≤ 0 fails if present.

## Files

| File | Action |
|---|---|
| `packages/shared/src/offer/schemas.ts` | new |
| `packages/shared/src/offer/schemas.test.ts` | new |
| `packages/shared/src/offer/offer-transitions.ts` | extend (canEditOffer, canWithdrawOffer) |
| `packages/shared/src/offer/offer-transitions.test.ts` | extend |
| `packages/shared/src/index.ts` | +export offer schemas |
| `migrations/<ts>_create-offers.sql` | new |
| `apps/web/app/api/offers/route.ts` | new (POST) |
| `apps/web/app/api/offers/mapping.ts` | new |
| `apps/web/app/api/offers/[id]/route.ts` | new (GET, PATCH, DELETE) |

Out-of-repo (CLI): storage bucket `offer-photos` + its RLS policy.

## Build sequence

1. shared schemas + transitions + tests (TDD) → build shared
2. migration offers + offer_photos + RLS → apply
3. storage bucket `offer-photos` (CLI) + object RLS policy
4. offers mapping + POST route → GET/PATCH/DELETE [id] routes
5. demand detail embed offers (update DEMAND_SELECT + mapping)
6. verify: curl POST (KYC gate, demand-status gate, unique gate, happy path),
   PATCH, DELETE

## Out of scope

- Buyer selecting offers (PENDING_SELLER_CONFIRMATION) — #11.
- Seller confirm/decline — #11.
- Offer auto-decline at 24h — #11 or later.
- Best-offer knapsack matching — #11.
- Offer list page for sellers ("my offers") — deferred; the GET [id] route +
  demand-detail embed cover the buyer-side view for now.
- Notification on new offer — #17.
