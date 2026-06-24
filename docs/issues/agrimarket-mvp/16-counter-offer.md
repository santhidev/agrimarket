Status: ready-for-agent

## What to build

Buyer sends counter-offer (desired pricePerUnit) to all sellers or specific sellers (sellerIds). Unlimited rounds. Counter-offer doesn't change offer state — seller can adjust price via PATCH. Seller sees competing sellers' counter-accepted prices only after they accept (adjust their price). Counter-offer UI in Blazor + MAUI.

## Acceptance criteria

- [ ] POST /demands/:id/counter-offer accepts { pricePerUnit, sellerIds?: [] }
- [ ] If sellerIds empty/omitted → broadcast to all sellers with ACTIVE offers
- [ ] SignalR: OfferHub.CounterOffer broadcasts to targeted sellers (+ FCM Push)
- [ ] Unlimited counter-offer rounds (no limit)
- [ ] Counter-offer doesn't change offer status (stays ACTIVE)
- [ ] Seller sees counter-offer price in Rider App / Seller UI
- [ ] Seller adjusts price via PATCH /offers/:id → OfferHub.OfferUpdated to competitors
- [ ] Competing sellers see adjusted price only after seller adjusts (not before)
- [ ] UI: counter-offer form (price input, select all or specific sellers)
- [ ] UI: seller sees counter-offer notification + can adjust price
- [ ] Unit tests: counter-offer to all, counter-offer to specific, unlimited rounds, no state change

## Blocked by

15