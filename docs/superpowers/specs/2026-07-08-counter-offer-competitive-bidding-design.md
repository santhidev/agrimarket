# Design — Counter-offer (#12) + Competitive bidding view (#11)

**Date:** 2026-07-08
**Issues:** #12 (Counter-offer) + #11 (Offer: Competitive bidding view)
**Status:** Implemented — both shipped in one session.

## Why one session

#11's visibility rule ("a competitor's price is hidden until that competitor
has accepted the current counter-offer") consumes #12's `counter_offer_price`.
Building #11 without #12 would mean a degraded rule (hide all competitors
until... nothing). Building #12 without #11 leaves the counter-offer stored
but unconsumed. The two are one feature; confirmed with the user.

## Scope

- **#12**: buyer sends a desired price → stored on the demand; unlimited
  rounds; does NOT change offer status; a seller whose `price_per_unit ≤
  counter_offer_price` is "accepted" (visible to competitors).
- **#11**: `GET /api/demands/:id/offers` — seller sees own offer + accepted
  competitors; buyer sees all; seller adjusts price inline via PATCH (#10).

## Decisions (confirmed with user)

1. **Counter-offer gate = `canEditDemand` (OPEN-only).** A closed demand is
   past negotiation. Unlimited rounds while OPEN; latest write wins.
2. **Seller notification deferred to #17.** Same seam as #09→#17: #12 persists
   the counter-offer; #17 adds the notification row + push delivery.

## Data model

### `public.demands` (ALTER — migration `20260707183721`)

```sql
alter table public.demands
  add column counter_offer_price numeric(12,2) null check (counter_offer_price > 0),
  add column counter_offer_at timestamptz null;
```

- `numeric(12,2)` matches `offers.price_per_unit` so the `≤` comparison is exact.
- No RLS change — `demands_update_owner_or_admin` already permits the buyer.

### `public.offers` RLS (migration `20260707184016`)

New `SECURITY DEFINER` helper + SELECT policy for competitor visibility:

```sql
create or replace function public.is_counter_offer_accepted(
  offer_price numeric, demand_uuid uuid
) returns boolean
language sql security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.demands d
    where d.id = demand_uuid
      and d.counter_offer_price is not null
      and d.status = 'OPEN'
      and offer_price <= d.counter_offer_price
  );
$$;

create policy "offers_select_competitor_accepted"
  on public.offers for select
  using (public.is_counter_offer_accepted(offers.price_per_unit, offers.demand_id));
```

- `SECURITY DEFINER` so the offers SELECT policy can read demands without
  recursing through offers RLS (mirrors `is_current_admin`).
- A seller's SELECT now returns: own offers (any status, via the existing
  `offers_select_buyer_or_seller_or_admin` policy) + accepted competitor
  offers (via this new policy).

## API

### `POST /api/demands/:id/counter-offer` (#12, new)

Body: `{ pricePerUnit: number > 0 }` (validated by `counterOfferSchema`).

Gate chain: 401 → 404 (demand missing/hidden under RLS) → 403 (not buyer) →
409 (not OPEN via `canEditDemand`) → 400 (bad body) → 200.

Sets `counter_offer_price` + `counter_offer_at`; latest write wins. Does NOT
touch any offer's status. Returns `{ demand: mapDemand(updatedRow) }`.

### `GET /api/demands/:id/offers` (#11, new)

Gate: 401 → 404 (demand missing/hidden — OPEN public, non-OPEN owner/admin).

Role-shaped response:
- **Buyer**: `{ counterOfferPrice, offers: [{...full, sellerPhone}] }`.
- **Seller**: `{ counterOfferPrice, myOffer: {...full} | null, competitors:
  [{ sellerPhone, pricePerUnit, accepted }] }`.

The seller's own offer is always full-detail; competitors are name+price only
(not quantity/location/photos — those are the buyer's evaluation criteria).
The seller adjusts price via `PATCH /api/offers/:id` (#10).

## Visibility enforcement (two layers)

1. **DB (RLS)**: `offers_select_competitor_accepted` hides non-accepted
   competitor offers from a seller's SELECT. The route's query never receives
   them — no existence leak.
2. **Route**: `isCounterOfferAccepted` (pure, in shared) re-checks per
   competitor so the response is self-documenting and matches the unit-tested
   rule.

## Shared package (`packages/shared/src/demand/`)

- `counter-offer.ts` (new): `isCounterOfferAccepted(offerPrice,
  counterOfferPrice | null)`. Pure. 5 tests.
- `schemas.ts`: `counterOfferSchema` + `counterOfferPrice`/`counterOfferAt` on
  `demandSchema`. 6 tests.
- Full shared suite: 195 passed (was 184).

## Verification

- **Anon 401**: both new routes return 401 (verified via dev server).
- **DB helper + predicate** (admin-client script against dev DB): counter=20,
  A@25 → not accepted (hidden), B@18 → accepted (visible), tie=accepted,
  no-counter → not accepted. All pass. Cleanup ran.
- **Unit tests**: 11 new (5 predicate + 6 schema).
- **Owner-side HTTP happy path**: gap (browser MCP down) — same as #10.

## Out of scope / deferred

- Seller notification (#17) — the route leaves a TODO; #17 adds the row + push.
- `profiles.name` — currently `phone` is the only identifier; a future
  `display_name` column would be a drop-in for the competitor/buyer view.
- Aggregate pre-counter-offer view — simplified to "own offer + accepted
  competitors only" (competitors array is empty before any counter-offer).
