Status: ready-for-agent

## What to build

Seller (KYC approved) submits offer with productGradeId, pricePerUnit, quantity, photos[], pickupLat, pickupLng, readyDate. 1 seller = 1 offer per Demand (unique demand_id + seller_id). Seller can edit (price, quantity, location, readyDate, grade) or withdraw offer. Offer UI in Blazor + MAUI.

## Acceptance criteria

- [ ] POST /demands/:id/offers accepts { pricePerUnit, quantity, productGradeId, photos, pickupLat, pickupLng, readyDate }
- [ ] KYC status checked — only APPROVED sellers can submit
- [ ] Unique constraint: 1 seller = 1 offer per Demand
- [ ] PATCH /offers/:id updates price, quantity, pickupLat, pickupLng, readyDate, productGradeId
- [ ] DELETE /offers/:id → status WITHDRAWN
- [ ] Offer status starts as ACTIVE
- [ ] accepted_quantity nullable (set when buyer selects)
- [ ] UI: submit offer form (price, quantity, grade select, photo capture, map pin, date picker)
- [ ] UI: edit offer form
- [ ] UI: withdraw button with confirmation
- [ ] Unit tests: submit, edit, withdraw, KYC check, unique constraint, grade validation

## Blocked by

06, 08