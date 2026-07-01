Status: ready-for-agent

## What to build

User profile page (`GET /api/users/:id/profile` → phone, KYC status, credit tier, scores) and the admin bootstrap: an admin gate (middleware/route guard checking `is_admin`) plus the credit-tier field as a placeholder (`None` default). The admin user is already seeded in 01; this issue adds the ability to read profile + an admin-only route skeleton (`GET /api/admin/users` list).

## Acceptance criteria

- [ ] `GET /api/users/:id/profile` returns phone, kycStatus, tier, buyerScore, sellerScore, isAdmin
- [ ] Profile page renders the current user's data
- [ ] Non-admin requests to `/api/admin/*` return 403
- [ ] `GET /api/admin/users` lists users (admin only)
- [ ] `tier` defaults to `None`; `buyerScore`/`sellerScore` default to 0
- [ ] Vitest: profile shape, admin gate (admin allowed, non-admin denied, anonymous denied)

## Blocked by

02
