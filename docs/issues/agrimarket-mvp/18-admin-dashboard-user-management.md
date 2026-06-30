Status: ready-for-agent

## What to build

Admin dashboard + user management: `GET /api/admin/dashboard` returns metrics (total users, total demands, fulfillment rate, transaction success, repeat rate) computed from existing tables; `GET /api/admin/users` with search/filter by KYC status and tier; `PATCH /api/admin/users/:id/credit-tier` to set a user's tier (Phase 2 credit prep — placeholder field). Admin-only (gate from 03).

## Acceptance criteria

- [ ] `GET /api/admin/dashboard` returns the 5 metrics computed from DB
- [ ] `GET /api/admin/users` supports filtering by kyc_status and tier
- [ ] `PATCH /api/admin/users/:id/credit-tier` sets the tier
- [ ] All admin endpoints reject non-admins (403)
- [ ] Dashboard page renders the metrics
- [ ] Vitest: metric calculations (fulfillment rate, repeat rate), filter logic, admin gate

## Blocked by

03
