Status: ready-for-agent

## What to build

Admin user management — search/filter users by kycStatus and tier. Set credit tier per user. Admin Blazor WASM user management UI.

## Acceptance criteria

- [ ] GET /admin/users with query params (search, kycStatus, tier)
- [ ] PATCH /admin/users/:id/credit-tier accepts { tier }
- [ ] Admin UI: user list with search bar + filters (KYC status dropdown, tier dropdown)
- [ ] Admin UI: user detail with credit tier selector
- [ ] Unit tests: search, filter by kycStatus, filter by tier, credit tier update
- [ ] Integration test: user management CRUD

## Blocked by

07