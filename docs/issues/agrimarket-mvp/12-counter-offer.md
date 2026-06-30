Status: ready-for-agent

## What to build

Counter-offer: buyer sends a desired price to all (or specific) sellers via `POST /api/demands/:id/counter-offer` (stores the latest desired price on the demand). Unlimited rounds. Does NOT change offer state — sellers respond by editing their own offer price (reuses PATCH). When a seller's price drops to ≤ the counter-offer price, they are marked as "accepted" for the visibility rule in 11 (their price becomes visible to competitors). Sellers are notified (event emitted; consumed by 17).

## Acceptance criteria

- [ ] Buyer can send a counter-offer (desired price) — unlimited times
- [ ] Counter-offer does not change any offer's status
- [ ] A seller whose offer price ≤ counter-offer price is "accepted" → visible to competitors (feeds 11)
- [ ] Seller sees the latest counter-offer price
- [ ] Vitest: counter stored; acceptance threshold (equal/just-below); unlimited rounds allowed

## Blocked by

10
