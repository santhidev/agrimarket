Status: ready-for-agent

## What to build

Buyer extends Demand deadline, cancels Demand, shares Demand via deeplink. Cancel notifies all sellers who submitted offers (all offers → CANCELLED). Deeplink opens demand detail in app or app store if not installed.

## Acceptance criteria

- [ ] PATCH /demands/:id/extend accepts { newDeadline } — only from OPEN state
- [ ] DELETE /demands/:id cancels demand — from OPEN or MATCHED state
- [ ] Cancel: all offers (ACTIVE, PENDING_SELLER_CONFIRMATION, CONFIRMED, SELECTED) → CANCELLED
- [ ] Cancel: notify all sellers via SignalR (OfferHub events)
- [ ] Deeplink: /demands/:id opens in app or redirects to app store
- [ ] UI: extend deadline button, cancel button with confirmation, share button (deeplink to LINE/Facebook)
- [ ] Unit tests: extend (valid/invalid state), cancel (valid/invalid state), offer cascade cancel

## Blocked by

08