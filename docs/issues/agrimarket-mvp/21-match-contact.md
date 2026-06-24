Status: ready-for-agent

## What to build

Buyer confirms self-pickup after all desired sellers confirm. Demand → MATCHED. System opens seller phone number for buyer. Non-confirmed/non-selected offers → REJECTED. SignalR notifications to all affected. Match UI in Blazor + MAUI.

## Acceptance criteria

- [ ] POST /demands/:id/match → Demand status MATCHED (from OPEN, requires at least 1 CONFIRMED offer)
- [ ] CONFIRMED offers → MATCHED status
- [ ] All non-CONFIRMED offers (ACTIVE, PENDING_SELLER_CONFIRMATION, DECLINED) → REJECTED (DECLINED stays DECLINED)
- [ ] pending_quantity → 0
- [ ] Buyer can see seller phone numbers for MATCHED offers
- [ ] SignalR: DemandHub.StatusChanged → buyer + selected sellers (+ FCM Push)
- [ ] SignalR: OfferHub.OfferRejected → rejected sellers
- [ ] UI: match confirmation screen showing confirmed sellers with phone numbers
- [ ] UI: "โทร" button per seller (opens phone dialer)
- [ ] Unit tests: match with confirmed offers, match rejects non-confirmed, phone reveal, offer cascade

## Blocked by

20