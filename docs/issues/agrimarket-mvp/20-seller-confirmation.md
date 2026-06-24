Status: ready-for-agent

## What to build

Seller confirms or declines sale. confirm-sale → CONFIRMED. decline-sale → DECLINED. PENDING_SELLER_CONFIRMATION auto-declines after 24h (Hangfire). Seller notified via Push when selected. Buyer notified via SignalR + Push when seller confirms/declines. UI in Blazor + MAUI.

## Acceptance criteria

- [ ] POST /offers/:id/confirm-sale → status CONFIRMED (only from PENDING_SELLER_CONFIRMATION)
- [ ] POST /offers/:id/decline-sale → status DECLINED (only from PENDING_SELLER_CONFIRMATION)
- [ ] Hangfire: PENDING_SELLER_CONFIRMATION > 24h → auto DECLINED
- [ ] SignalR: OfferHub.SellerConfirmed → buyer (+ FCM Push)
- [ ] SignalR: OfferHub.SellerDeclined → buyer
- [ ] Seller gets FCM Push when selected (new job notification)
- [ ] UI: seller sees pending confirmation requests with offer details
- [ ] UI: confirm/decline buttons
- [ ] UI: 24h countdown timer displayed
- [ ] Unit tests: confirm flow, decline flow, auto-decline (Hangfire), invalid state transitions
- [ ] Integration test: Hangfire auto-decline after 24h

## Blocked by

19