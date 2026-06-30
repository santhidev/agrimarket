Status: ready-for-agent

## What to build

Offer submission by a seller: submit (`POST /api/offers` with demand_id, product_grade_id, price_per_unit, quantity, photos[], pickup_lat/lng, ready_date), edit (`PATCH /api/offers/:id`), withdraw (`DELETE /api/offers/:id` → WITHDRAWN). Enforces: seller must have `kyc_status = APPROVED`; 1 seller = 1 offer per Demand (unique demand_id + seller_id); Demand must be OPEN. Status ACTIVE.

## Acceptance criteria

- [ ] KYC-approved seller can submit an offer on an OPEN demand
- [ ] Unique constraint: a seller cannot create a second offer on the same demand (edit the existing one instead)
- [ ] Seller can edit price/quantity/location/ready_date on their own ACTIVE offer
- [ ] Seller can withdraw their offer (→ WITHDRAWN)
- [ ] Non-KYC-approved users get 403 on submit
- [ ] Submitting on a non-OPEN demand fails
- [ ] Vitest: KYC gate, unique constraint, withdraw transition, demand-status gate

## Blocked by

06, 07
