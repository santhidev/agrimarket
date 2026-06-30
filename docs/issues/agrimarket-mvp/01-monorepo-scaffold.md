Status: ready-for-agent

## What to build

Bootstrap the TypeScript monorepo: Turborepo + pnpm workspaces. Create `apps/web` (Next.js 15 App Router), `packages/database` (Prisma + PostgreSQL, connects to the existing docker-compose), `packages/shared` (empty, for zod + types + logic later). Wire `pnpm install` + `pnpm dev` so the Next.js app boots and can query Postgres through Prisma. Apply the first migration creating the `users` table (id, phone, tier, buyer_score, seller_score, kyc_status, is_admin, is_rider, is_hub_staff, hub_id, created_at) and seed an admin from an env var. Add a smoke API route `GET /api/health` returning `{ ok: true, db: <connected> }`.

## Acceptance criteria

- [ ] `pnpm install` succeeds with no errors
- [ ] `pnpm dev` boots the Next.js app on localhost:3000
- [ ] Prisma connects to the docker-compose Postgres; `pnpm db:migrate` applies the `users` migration
- [ ] `GET /api/health` returns `{"ok":true,"db":true}` HTTP 200
- [ ] Admin user seeded from `ADMIN_PHONE` env exists in `users`
- [ ] Turborepo `build` task runs across workspaces

## Blocked by

None - can start immediately
