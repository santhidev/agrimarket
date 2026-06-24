Status: ready-for-agent

## What to build

FCM push notifications via FirebaseAdmin .NET SDK. Strategy: FCM (app closed) + SignalR (app open). 5 push events: NewDemand, NewOffer, CounterOffer, SellerConfirmed, StatusChanged. fcm_token saved on login. notifications table records all events with event_type enum.

## Acceptance criteria

- [ ] FirebaseAdmin SDK initialized with service account
- [ ] FCM push sent for 5 events (NewDemand, NewOffer, CounterOffer, SellerConfirmed, StatusChanged)
- [ ] Strategy pattern: check if SignalR connected → skip FCM, else send FCM
- [ ] notifications table: event_type enum (DEMAND_NEW/OFFER_NEW/COUNTER_OFFER/SELLER_CONFIRMED/SELLER_DECLINED/STATUS_CHANGED/OFFER_REJECTED)
- [ ] read_at nullable (NULL = unread)
- [ ] Unit tests: FCM send, strategy (SignalR vs FCM), notification record creation
- [ ] Integration test: push received on device (manual)

## Blocked by

12