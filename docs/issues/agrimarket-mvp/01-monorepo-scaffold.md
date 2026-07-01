Status: done

## What to build

Bootstrap the TypeScript monorepo: Turborepo + pnpm workspaces. Create `apps/web` (Next.js 15 App Router), `packages/database` (Prisma + PostgreSQL, connects to the existing docker-compose), `packages/shared` (empty, for zod + types + logic later). Wire `pnpm install` + `pnpm dev` so the Next.js app boots and can query Postgres through Prisma. Apply the first migration creating the `users` table (id, phone, tier, buyer_score, seller_score, kyc_status, is_admin, is_rider, is_hub_staff, hub_id, created_at) and seed an admin from an env var. Add a smoke API route `GET /api/health` returning `{ ok: true, db: <connected> }`.

## Acceptance criteria

- [x] `pnpm install` succeeds with no errors
- [x] `pnpm dev` boots the Next.js app on localhost:3000
- [x] Prisma connects to the docker-compose Postgres; `pnpm db:migrate` applies the `users` migration
- [x] `GET /api/health` returns `{"ok":true,"db":true}` HTTP 200
- [x] Admin user seeded from `ADMIN_PHONE` env exists in `users`
- [x] Turborepo `build` task runs across workspaces

## Blocked by

None - can start immediately

## Comments

### Implementation — 2026-06-30

Scaffolded the TypeScript monorepo (Turborepo + pnpm workspaces). All acceptance criteria verified at runtime.

**Structure created:**
- Root: `package.json` (delegates to `turbo run`), `pnpm-workspace.yaml` (apps/*, packages/*), `turbo.json` (build/dev/lint/typecheck/test), base `tsconfig.json` (solution-style paths)
- `packages/database` (`@agrimarket/database`): Prisma schema + generated client + `PrismaPg` driver-adapter singleton + `seedAdmin(phone)`. Prisma 6 (stable; 7 is too new), `prisma-client-js` generator → `generated/client`, `env("DATABASE_URL")` in schema.
- `packages/shared` (`@agrimarket/shared`): empty stub for zod/types/logic later.
- `apps/web` (`@agrimarket/web`): Next.js 15 App Router, RSC home page, `GET /api/health` → `{ok, db}`, seed script via `tsx`.

**Migration:** `init_users` created the `users` table (id, phone unique, tier/buyerScore/sellerScore/kycStatus as Int defaults, isAdmin/isRider/isHubStaff booleans, hubId nullable, createdAt). Applied to docker Postgres.

**Seeded:** admin `0899999999` (isAdmin=true, defaults) from `ADMIN_PHONE`.

**Verified:**
- `pnpm install` ✓
- `pnpm dev` → Next.js ready in ~3s on :3000
- `GET /api/health` → `{"ok":true,"db":true}` HTTP 200
- `pnpm build` (turbo) → 3 packages successful (1 cached)
- DB: `users` table + admin row confirmed via psql

**Notes / gotchas for later issues:**
- pnpm 11 blocks install-time build scripts; `onlyBuiltDependencies` in `pnpm-workspace.yaml` allows prisma/sharp/esbuild. The `pnpm approve-builds` command keeps re-inserting a placeholder `allowBuilds` block — ignore it, the `onlyBuiltDependencies` list is the source of truth.
- Seed script uses `tsx --env-file=.env` (tsx, not raw `node --experimental-strip-types`, because the Prisma generated client uses directory imports that need a TS resolver).
- `.env` lives in each package that needs it (`apps/web/.env`, `packages/database/.env`) — no root `.env` (monorepo anti-pattern per ADR 0002).

### Migrated to InsForge — 2026-06-30

The Prisma + docker-compose Postgres backend was replaced by **InsForge BaaS** per ADR 0003. The monorepo shell (Turborepo + Next.js + shared) is unchanged; only the data layer changed:

- `packages/database` now exports an `@insforge/sdk` client singleton (`createClient` + `createAdminClient`) instead of a Prisma client. No schema/migrations — InsForge manages the Postgres schema.
- The `users` table is InsForge's managed `auth.users`; AgriMarket-specific fields (tier, kyc_status, is_admin, ...) live in its `profile` jsonb column (per ADR 0003 decision).
- `GET /api/health` now queries InsForge (`auth.users` head count) → verified `{"ok":true,"db":true}`.
- The admin-seed step moved to InsForge (auth.users managed, no local seed script).
- `.insforge/project.json` (gitignored, contains API key) + `.env.local` (anon key + URL) replaced the old `.env` files.
