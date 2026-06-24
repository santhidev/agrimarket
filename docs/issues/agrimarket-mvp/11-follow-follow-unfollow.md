Status: ready-for-agent

## What to build

Users follow/unfollow products. Available immediately after registration (no KYC required). When new Demand created for followed product, followers get notified (DemandHub.NewDemand + FCM Push). Follow UI in Blazor + MAUI.

## Acceptance criteria

- [ ] POST /products/:id/follow — any authenticated user can follow
- [ ] DELETE /products/:id/follow — unfollow
- [ ] follows table: user_id + product_id (unique)
- [ ] Following available before KYC approval
- [ ] UI: follow/unfollow button on product detail
- [ ] UI: my followed products list
- [ ] Unit tests: follow, unfollow, duplicate follow prevented, follow without KYC

## Blocked by

02