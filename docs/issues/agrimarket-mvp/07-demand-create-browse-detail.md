Status: ready-for-agent

## What to build

Demand core: buyer creates (`POST /api/demands` with product_id, quantity, deadline, buyer_lat, buyer_lng), browses (`GET /api/demands` filter by product/status), views detail (`GET /api/demands/:id` with all its offers). Tracks `pending_quantity` (starts = quantity, drops as offers are PENDING/CONFIRMED, → 0 when MATCHED). Status OPEN. Buyer-only writes.

## Acceptance criteria

- [ ] Buyer can create a Demand (1 product, quantity, deadline, lat/lng)
- [ ] `GET /api/demands` supports filtering by product and status
- [ ] `GET /api/demands/:id` returns the demand + its offers
- [ ] `pending_quantity` initializes to `quantity`
- [ ] Only the buyer owner can modify their demand (write gate)
- [ ] Browse page + detail page render
- [ ] Vitest: create validation (zod), pending_quantity init, owner gate

## Blocked by

03, 04
