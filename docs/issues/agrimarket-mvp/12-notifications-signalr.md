Status: ready-for-agent

## What to build

SignalR hub setup with 9 hub events. OfferHub (NewOffer, OfferUpdated, CounterOffer, SellerConfirmed, SellerDeclined, OfferRejected), DemandHub (NewDemand, StatusChanged), NotificationHub (Push). Events broadcast to correct recipients (buyer, sellers, followers). Blazor + MAUI SignalR client integration.

## Acceptance criteria

- [ ] OfferHub.NewOffer broadcasts to demand buyer
- [ ] OfferHub.OfferUpdated broadcasts to buyer + competing sellers
- [ ] OfferHub.CounterOffer broadcasts to targeted sellers (or all)
- [ ] OfferHub.SellerConfirmed broadcasts to buyer
- [ ] OfferHub.SellerDeclined broadcasts to buyer
- [ ] OfferHub.OfferRejected broadcasts to rejected sellers (on match)
- [ ] DemandHub.NewDemand broadcasts to product followers
- [ ] DemandHub.StatusChanged broadcasts to buyer + selected sellers
- [ ] NotificationHub.Push — server to client
- [ ] Blazor WASM connects to SignalR hubs
- [ ] MAUI connects to SignalR hubs
- [ ] Unit tests: each hub event broadcasts to correct recipients
- [ ] Integration test: SignalR test client receives events

## Blocked by

02