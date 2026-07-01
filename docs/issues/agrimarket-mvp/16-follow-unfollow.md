Status: ready-for-agent

## What to build

Follow / unfollow products: any authenticated user can follow a product (`POST /api/products/:id/follow`) and unfollow (`DELETE /api/products/:id/follow`). Allowed immediately after registration — no KYC required (KYC gate is only on offer submission, not follow). `follows` table (user_id + product_id unique). The list of followed products drives the notification trigger in 17.

## Acceptance criteria

- [ ] Any authenticated user can follow/unfollow a product
- [ ] Following is allowed without KYC approval
- [ ] `follows` enforces unique (user_id + product_id)
- [ ] User can list their followed products
- [ ] Vitest: follow creates row, unfollow removes row, duplicate follow is idempotent, no-KYC allowed

## Blocked by

03
