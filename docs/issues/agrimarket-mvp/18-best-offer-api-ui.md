Status: ready-for-agent

## What to build

Best Offer API endpoint + UI. POST /demands/:id/best-offer returns ranked combinations with cost breakdown. UI shows ranked combinations with total price, per-offer breakdown, distance, grade. Buyer can select from combinations or manually select offers.

## Acceptance criteria

- [ ] POST /demands/:id/best-offer returns { combinations: [{ offers: [{ offerId, quantity, pricePerUnit, subtotal, distance }], total, totalQuantity, fulfillsDemand }] }
- [ ] Combinations sorted by total price ascending
- [ ] UI: best offer screen showing ranked combinations
- [ ] UI: each combination shows total price, per-offer breakdown (seller, price, qty, grade, distance)
- [ ] UI: tag "จัดส่งไม่ได้ (ระยะไกล)" if travel time ≥ shelf_life (Phase 2, informational for MVP)
- [ ] UI: buyer can tap combination to pre-fill select form
- [ ] Integration test: API returns correct combinations matching algorithm output

## Blocked by

17