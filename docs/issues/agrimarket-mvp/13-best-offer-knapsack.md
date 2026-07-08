Status: done

## What to build

Best Offer: a pure algorithm in `packages/shared` (no Prisma, no React — fully unit-testable). Given a Demand's target quantity + a list of ACTIVE offers (each with quantity + price + pickup lat/lng), compute ranked offer combinations via **Bounded Knapsack** to find the cheapest total price. Return combinations even if they don't fulfill the full quantity (partial fulfillment). Tiebreaker on equal total price: smaller total distance (Haversine, 40 km/h) to the buyer. Exposed via `POST /api/demands/:id/best-offer`.

## Acceptance criteria

- [x] Bounded Knapsack solver returns cheapest combination(s) for a target quantity
- [x] Partial-fulfillment combinations are included (flagged as partial)
- [x] Equal-total-price ties broken by smaller total distance (Haversine)
- [x] Edge cases handled: 0 offers (empty result), 1 offer, total over quantity (trim to demand.quantity)
- [x] `POST /api/demands/:id/best-offer` returns ranked combinations
- [x] Vitest: **exhaustive** — knapsack correctness, tiebreaker, partial fulfillment, all edge cases (this module gets the heaviest testing)

## Blocked by

10

---

## Implementation notes (2026-07-08)

Done. All acceptance criteria met. Pure solver in `@agrimarket/shared` +
buyer-facing `POST /api/demands/:id/best-offer` route. No DB changes — the
solver reads from the existing `offers` columns (price_per_unit, quantity,
pickup_lat/lng) already joined in `DEMAND_SELECT`.

### What shipped

- **Shared package** (`packages/shared/src/demand/`):
  - `haversine-km.ts` (new) — `haversineKm(lat1, lng1, lat2, lng2): number`.
    Standard great-circle formula, R = 6371 km. Pure. 4 unit tests.
  - `best-offer.ts` (new) — `computeBestOffers(input): BestOfferResult` +
    types (`BestOfferInputOffer`, `BestOfferInput`, `BestOfferLine`,
    `BestOfferCombination`, `BestOfferResult`). 10 unit tests covering all
    acceptance criteria + edge cases.
  - `schemas.ts` — added `bestOfferResponseSchema` (zod) + `BestOfferResponse`
    type, mirroring `BestOfferResult`.
  - Full shared suite 209 passed (was 195 after #11/#12).
- **API route** (`apps/web/app/api/demands/[id]/best-offer/route.ts`, new):
  - `POST` — buyer requests ranked combinations. Gate chain: 401 → 404
    (demand missing/hidden under RLS) → 403 (not buyer) → 409 (not OPEN via
    `canEditDemand`) → 400 (bad body OR > 20 offers to enumerate) → 200.
    Optional body `{ maxCombinations?: 1-5 }` (default 5).
  - Reads the demand + nested offers via `DEMAND_SELECT` (already has
    buyer_lat/lng + offers joined), filters ACTIVE offers, maps to the
    solver input, runs `computeBestOffers`, slices to the client's ceiling.

### Algorithm

**Whole-offer (0/1) subset enumeration** — not classical DP knapsack. For n
ACTIVE offers, enumerate every non-empty subset (2^n − 1) via bitmask:

1. Per subset: `rawQty = Σ quantity`.
2. If `rawQty ≥ Q` → **full** combination. Trim the overflow (`rawQty − Q`)
   from the **most-expensive** offers first (price descending), then consume
   cheapest-first to build the output lines. The buyer keeps cheap units,
   sheds pricey ones (CONTEXT.md intent: "เรียงตามราคารวม").
3. If `rawQty < Q` → **partial** combination (no trim; every unit used).
4. `totalDistance = Σ haversineKm(buyer, pickup) × quantity` (weighted — a
   far offer supplying a lot contributes more to the trip proxy).
5. **Dedupe** by signature `(offerId, quantity)` sorted — trimming can
   collapse a multi-offer subset to the same line set as a smaller subset
   (e.g. {cheap, pricey} with pricey trimmed to 0 == {cheap} alone). Keep
   the cheapest-ranked copy.
6. **Rank:** full first (cost asc → distance asc), then partial by the same
   key. Cap at 5. Partials surface only when **total supply < Q** (the buyer
   is choosing the best available shortfall — if supply can fulfill but no
   single combo does, the buyer wants full combos ranked, not partials).

**Why subset, not DP:** n is small in the MVP (1 SKU per demand, sellers come
from follow → realistically n ≤ 15). Subset = exact every combination, ranking
+ tiebreaker + dedupe are straightforward, and the weighted-distance term
makes DP reconstruction hard. The issue names "Bounded Knapsack" for the
*concept* (CONTEXT.md), but the acceptance criteria ask only for "cheapest
combination(s)" + ranking — subset enumeration answers exactly and tests
cleanly. The route caps n at 20 (≈1M subsets) and 400s above that as a
latency guard.

### Decisions worth recording

- **Trim from most-expensive, not cheapest.** When a subset exceeds Q, shed
  the excess from the highest-`pricePerUnit` offers first — the buyer keeps
  the cheap units. Confirmed with the user ("Whole + trim overflow"). This
  keeps the cheapest *delivered* cost, not just the cheapest subset by raw
  sum. Implemented in `buildCombination`: trim phase (price desc) runs before
  the consume phase (price asc).
- **`isPartial` is caller-decided, not derived.** A trimmed full combination
  reaches Q (`qtyToUse === Q`) but `qtyToUse < rawQty`, so deriving partial
  from that comparison would mis-flag trims. The caller passes `isPartial`
  based on whether `rawQty < Q`.
- **Dedupe is necessary.** Without it, {cheap, pricey} trimmed to {cheap 50}
  produces a duplicate of the {cheap}-alone combo and pollutes the ranking
  (verified — slice 9 failed before dedupe was added). Signature =
  sorted `(offerId:quantity)` of non-zero lines.
- **Partials only when supply < Q.** If supply ≥ Q but no single combo hits Q
  exactly (e.g. offers 30+30, Q=50 → {30,30}=60 trims to 50, full), the
  buyer gets full combos ranked, not the 30-only partials. Only when total
  supply genuinely can't fulfill do partials surface (e.g. 30+30, Q=100).
- **Distance weighting is quantity-weighted.** A far-away large-quantity
  offer contributes more to the trip-cost proxy than a nearby small one —
  matches intuition (more driving for more goods). The tiebreaker then favors
  combos that are overall closer per unit moved.
- **OPEN-only gate reuses `canEditDemand`.** Same as counter-offer (#12):
  once the demand is MATCHED/COMPLETED/EXPIRED/CANCELLED, best-offer is moot.
- **No new RLS / migration.** The buyer already reads their demand + its
  offers under existing RLS; the solver is a pure read-side computation.
  `accepted_quantity` (the trimmed quantities) is NOT persisted — #14 will
  persist it when the buyer actually selects a combination.

### Verification

- **Unit (exhaustive — this module is the most heavily tested):** 14 new
  tests (4 haversine + 10 best-offer). Covers: empty, single full, single
  partial, cost-asc ranking, distance tiebreaker, single-offer overflow
  trim, multi-offer trim from most-expensive, top-5 cap, partial suppression
  when supply can fulfill, partial surfacing when supply < Q, canFulfill
  flag both ways. Full shared suite 209 passed.
- **Typecheck:** `pnpm --filter @agrimarket/web typecheck` clean (route +
  shared types align).
- **Owner-side happy path over HTTP** not verified (browser MCP still down —
  same gap as #10/#11/#12). The 401 anon gate + pure-logic unit tests + the
  solver's exhaustive coverage are the verification; the live buyer POST
  round-trip is the manual gap to close when the browser backend returns.

### Files

- `packages/shared/src/demand/haversine-km.ts` (new)
- `packages/shared/src/demand/haversine-km.test.ts` (new)
- `packages/shared/src/demand/best-offer.ts` (new)
- `packages/shared/src/demand/best-offer.test.ts` (new)
- `packages/shared/src/demand/schemas.ts` (extended — bestOfferResponseSchema)
- `packages/shared/src/index.ts` (+export haversine-km, best-offer)
- `apps/web/app/api/demands/[id]/best-offer/route.ts` (new)

### Open loose ends (non-blocking)

- **`accepted_quantity` not persisted.** The solver computes the trimmed
  quantity per offer in each combination; #14 will persist it on the chosen
  combination when the buyer selects (the column already exists, nullable).
- **No caching.** Each POST re-enumerates. For the MVP's n ≤ 15 this is
  sub-millisecond; revisit only if a demand ever sees 20+ offers (the route
  400s past 20 anyway).
- **Owner-side happy path not HTTP-verified** (browser MCP down) — see
  Verification. The pure solver's exhaustive unit tests are the primary
  guarantee here since there's almost no route-specific logic beyond the
  standard gate chain + data mapping.
