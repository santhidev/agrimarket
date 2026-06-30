Status: ready-for-agent

## What to build

Best Offer: a pure algorithm in `packages/shared` (no Prisma, no React — fully unit-testable). Given a Demand's target quantity + a list of ACTIVE offers (each with quantity + price + pickup lat/lng), compute ranked offer combinations via **Bounded Knapsack** to find the cheapest total price. Return combinations even if they don't fulfill the full quantity (partial fulfillment). Tiebreaker on equal total price: smaller total distance (Haversine, 40 km/h) to the buyer. Exposed via `POST /api/demands/:id/best-offer`.

## Acceptance criteria

- [ ] Bounded Knapsack solver returns cheapest combination(s) for a target quantity
- [ ] Partial-fulfillment combinations are included (flagged as partial)
- [ ] Equal-total-price ties broken by smaller total distance (Haversine)
- [ ] Edge cases handled: 0 offers (empty result), 1 offer, total over quantity (trim to demand.quantity)
- [ ] `POST /api/demands/:id/best-offer` returns ranked combinations
- [ ] Vitest: **exhaustive** — knapsack correctness, tiebreaker, partial fulfillment, all edge cases (this module gets the heaviest testing)

## Blocked by

10
