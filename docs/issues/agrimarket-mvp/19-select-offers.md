Status: ready-for-agent

## What to build

Buyer selects offers with quantities. Selected offers → PENDING_SELLER_CONFIRMATION. sum(selections.quantity) > 0 and ≤ demand.quantity. CONFIRMED offers that were previously confirmed go back to ACTIVE (re-select resets). pending_quantity updated. All non-selected ACTIVE offers stay ACTIVE. Select UI in Blazor + MAUI.

## Acceptance criteria

- [ ] POST /demands/:id/select accepts { selections: [{ offerId, quantity }] }
- [ ] sum(selections.quantity) > 0 and ≤ demand.quantity validated
- [ ] Selected offers → PENDING_SELLER_CONFIRMATION
- [ ] Previously CONFIRMED offers → ACTIVE (must re-select + re-confirm)
- [ ] accepted_quantity set on each selected offer
- [ ] pending_quantity updated (sum of PENDING_SELLER_CONFIRMATION + CONFIRMED offers)
- [ ] SignalR: notify selected sellers (SellerConfirmed flow starts)
- [ ] UI: select offers screen (from best offer or manual), quantity input per offer, total summary
- [ ] Unit tests: select valid, select 0 quantity rejected, select over demand.quantity rejected, CONFIRMED→ACTIVE reset, pending_quantity update

## Blocked by

18