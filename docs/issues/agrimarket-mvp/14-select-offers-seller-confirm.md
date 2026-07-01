Status: ready-for-agent

## What to build

Buyer selects offers (with quantities) via `POST /api/demands/:id/select` → those offers move to PENDING_SELLER_CONFIRMATION; rejected ones → REJECTED. Constraint: sum(selected quantity) > 0 and ≤ demand.quantity. Sellers confirm (`POST /api/offers/:id/confirm-sale` → CONFIRMED) or decline (`POST /api/offers/:id/decline-sale` → DECLINED). When the buyer re-selects after a decline, prior CONFIRMED offers revert to ACTIVE (must be re-selected + re-confirmed).

## Acceptance criteria

- [ ] Buyer can select offers with quantities (sum > 0, ≤ demand.quantity)
- [ ] Selected offers → PENDING_SELLER_CONFIRMATION; non-selected → REJECTED
- [ ] Seller can confirm or decline a pending offer
- [ ] Re-selecting after a decline reverts prior CONFIRMED offers to ACTIVE
- [ ] Only the demand owner can select; only the offer owner can confirm/decline
- [ ] Vitest: select constraint, state transitions (PENDING→CONFIRMED, PENDING→DECLINED), CONFIRMED→ACTIVE on re-select, owner gates

## Blocked by

13
