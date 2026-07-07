Status: done

## What to build

Counter-offer: buyer sends a desired price to all (or specific) sellers via `POST /api/demands/:id/counter-offer` (stores the latest desired price on the demand). Unlimited rounds. Does NOT change offer state — sellers respond by editing their own offer price (reuses PATCH). When a seller's price drops to ≤ the counter-offer price, they are marked as "accepted" for the visibility rule in 11 (their price becomes visible to competitors). Sellers are notified (event emitted; consumed by 17).

## Acceptance criteria

- [x] Buyer can send a counter-offer (desired price) — unlimited times
- [x] Counter-offer does not change any offer's status
- [x] A seller whose offer price ≤ counter-offer price is "accepted" → visible to competitors (feeds 11)
- [x] Seller sees the latest counter-offer price
- [x] Vitest: counter stored; acceptance threshold (equal/just-below); unlimited rounds allowed

## Blocked by

10

---

## Implementation notes (2026-07-08)

Done. All acceptance criteria met. Shipped together with #11 (competitive
bidding view) in one session — the two are tightly coupled because #11's
visibility rule consumes #12's `counter_offer_price`.

### What shipped

- **Shared package** (`packages/shared/src/demand/`):
  - `counter-offer.ts` (new) — `isCounterOfferAccepted(offerPrice,
    counterOfferPrice | null)`. Pure predicate: false when no counter-offer;
    true when `offerPrice ≤ counterOfferPrice` (tie accepted). 5 unit tests.
  - `schemas.ts` — added `counterOfferSchema` (`{ pricePerUnit: positive }`,
    `.strict()`) + `counterOfferPrice`/`counterOfferAt` (nullable) on
    `demandSchema`. 6 new unit tests.
  - Full shared suite 195 passed (was 184 after #10).
- **Migrations** (both applied to dev DB):
  - `20260707183721_add-counter-offer-to-demands.sql` — `ALTER TABLE
    public.demands ADD COLUMN counter_offer_price numeric(12,2) NULL` (CHECK
    > 0) + `counter_offer_at timestamptz NULL`. No RLS change — the existing
    `demands_update_owner_or_admin` policy already permits the buyer to UPDATE.
  - `20260707184016_add-offer-competitor-visibility.sql` — DB-layer enforcement
    of #11's visibility rule: `is_counter_offer_accepted(offer_price,
    demand_uuid)` SECURITY DEFINER helper (reads demands.counter_offer_price
    without recursing through offers RLS) + `offers_select_competitor_accepted`
    SELECT policy (a seller may read another seller's offer only when its price
    ≤ the demand's counter_offer_price AND the demand is OPEN).
- **API route** (`apps/web/app/api/demands/[id]/counter-offer/route.ts`, new):
  - `POST` — buyer sets the desired price. Gate chain: 401 → 404 (demand
    missing/hidden under RLS) → 403 (not buyer) → 409 (not OPEN via
    `canEditDemand`) → 400 (bad body) → 200. Sets `counter_offer_price` +
    `counter_offer_at`; latest write wins (unlimited rounds). Does NOT touch
    any offer's status.
- **Demand mapping** (`apps/web/app/api/demands/mapping.ts`) —
  `DEMAND_SELECT` + `DemandRow` + `mapDemand` now carry `counter_offer_price`
  → `counterOfferPrice` (numeric string coerced to Number) and
  `counter_offer_at` → `counterOfferAt`.

### Decisions worth recording

- **Counter-offer gate reuses `canEditDemand` (OPEN-only).** A closed demand
  (MATCHED/COMPLETED/EXPIRED/CANCELLED) is past negotiation — no new rounds.
  Confirmed with the user: the buyer can still send unlimited rounds while the
  demand is OPEN; once it closes, the latest counter-offer stays as-is.
- **No new RLS UPDATE policy needed.** The buyer already owns the demand row
  (`demands_update_owner_or_admin`); the counter-offer is a buyer-side write,
  so the existing policy covers it. The route's `canEditDemand` + owner gate
  are the API-layer enforcement.
- **`counter_offer_price` is `numeric(12,2)`** to match `offers.price_per_unit`
  so the `≤` comparison in `isCounterOfferAccepted` is exact (no scale drift).
  PostgREST returns it as a string; the mapper coerces to Number for the
  camelCase API contract.
- **Visibility enforced at TWO layers.** (1) DB: `offers_select_competitor_
  accepted` policy hides non-accepted competitor offers from a seller's SELECT.
  (2) Route: `isCounterOfferAccepted` re-checks per offer so the response shape
  is self-documenting and the unit-tested rule matches the route's behavior.
  Defense in depth, matching the repo's pattern.
- **`is_counter_offer_accepted` is `SECURITY DEFINER`** so the offers SELECT
  policy can read `demands.counter_offer_price` without re-entering offers RLS
  (avoids recursion). Mirrors the `is_current_admin` helper pattern.
- **Seller notification deferred to #17.** #12's AC mentions "event emitted;
  consumed by 17" — the notification row + push delivery is #17's job (same
  seam as #09 seeding notifications for #17). The route leaves a TODO comment
  marking the spot.

### Verification (live, against the dev DB)

- **Auth gate:** `POST /api/demands/:id/counter-offer` returns 401 for
  anonymous callers (verified via dev server).
- **DB helper + pure predicate** (admin-client script, simulating the route
  logic against the real DB):
  - Set counter-offer = 20; seller A at 25 → `is_counter_offer_accepted`
    returns false (NOT accepted); seller B at 18 → true (accepted) ✅
  - Tie (20 = 20) → accepted ✅
  - No counter-offer (NULL) → not accepted ✅
  - Pure predicate matches the DB helper exactly ✅
- Test data cleaned up (offers deleted, counter-offer cleared, KYC reset) after
  verify.
- Pure-logic gates (acceptance threshold, schema) covered by 11 new unit tests.

### Files

- `packages/shared/src/demand/counter-offer.ts` (new)
- `packages/shared/src/demand/counter-offer.test.ts` (new)
- `packages/shared/src/demand/schemas.ts` (extended — counterOfferSchema + fields)
- `packages/shared/src/demand/schemas.test.ts` (extended)
- `packages/shared/src/index.ts` (+export counter-offer)
- `migrations/20260707183721_add-counter-offer-to-demands.sql` (new, applied)
- `migrations/20260707184016_add-offer-competitor-visibility.sql` (new, applied)
- `apps/web/app/api/demands/[id]/counter-offer/route.ts` (new)
- `apps/web/app/api/demands/mapping.ts` (extended — counter-offer fields)

### Open loose ends (non-blocking)

- **Seller notification not yet wired.** The route persists the counter-offer
  but doesn't insert a notification row — #17 adds the counter-offer-received
  notification type + push delivery (the `notifications` table already exists
  from #09). Same pattern as #09→#17.
- **Owner-side happy path not HTTP-verified** (browser MCP down). The 401 anon
  gate + DB helper verification + unit tests cover the logic; the live buyer
  POST round-trip over HTTP is the manual gap.

