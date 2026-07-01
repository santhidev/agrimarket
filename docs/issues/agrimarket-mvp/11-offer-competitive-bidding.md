Status: ready-for-agent

## What to build

Competitive bidding view: a seller sees competing offers on a Demand (price + competing seller name) so they can adjust. The view is exposed on `GET /api/demands/:id/offers` for sellers. Sellers see competitors' prices only after those competitors have accepted the latest counter-offer (ties into 12); before that, a seller sees only aggregate/own data.

## Acceptance criteria

- [ ] `GET /api/demands/:id/offers` returns the calling seller's own offer + visible competitors
- [ ] A competitor's price is hidden until that competitor has accepted the current counter-offer
- [ ] Seller can adjust their own price inline (reuses PATCH from 10)
- [ ] Buyer sees all offers with full detail
- [ ] Vitest: visibility rules (hidden vs revealed), buyer vs seller view shapes

## Blocked by

10
