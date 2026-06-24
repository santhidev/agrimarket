Status: ready-for-agent

## What to build

Seller sees all competing offers (price + seller name) on the same Demand. Real-time update when competing seller edits price (OfferHub.OfferUpdated). Competitive bidding visibility UI in Blazor + MAUI.

## Acceptance criteria

- [ ] GET /demands/:id/offers returns all offers with seller name + price + grade
- [ ] Seller sees competing offers (price + name + grade) — not just own offer
- [ ] SignalR: OfferHub.OfferUpdated broadcasts to buyer + all competing sellers on that demand
- [ ] Real-time price update visible in UI when competing seller changes price
- [ ] UI: offer list showing all competitors with price + grade + seller name
- [ ] UI: highlight seller's own offer
- [ ] Unit tests: offer visibility, competing offers returned, real-time update routing

## Blocked by

14