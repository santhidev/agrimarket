Status: ready-for-agent

## What to build

Buyer creates Demand (productId, quantity, deadline, buyerLat, buyerLng). Browse Demands by product/status/sort. View Demand details with all offers. Demand UI in Blazor + MAUI. deadline = วันที่ buyer อยากได้ของ (offer.readyDate ≥ deadline).

## Acceptance criteria

- [ ] POST /demands accepts { productId, quantity, deadline, buyerLat, buyerLng }
- [ ] GET /demands with query params (productId, status, sort)
- [ ] GET /demands/:id returns demand with offers
- [ ] Demand status starts as OPEN
- [ ] pending_quantity defaults to 0
- [ ] UI: create demand form (product select, quantity, deadline picker, map pin for location)
- [ ] UI: demand list with filters
- [ ] UI: demand detail with offers list
- [ ] Unit tests: create demand, browse with filters, detail with offers
- [ ] Integration test: full demand CRUD

## Blocked by

03