Status: done

## What to build

User profile page (`GET /api/users/:id/profile` → phone, KYC status, credit tier, scores) and the admin bootstrap: an admin gate (middleware/route guard checking `is_admin`) plus the credit-tier field as a placeholder (`None` default). The admin user is already seeded in 01; this issue adds the ability to read profile + an admin-only route skeleton (`GET /api/admin/users` list).

## Acceptance criteria

- [x] `GET /api/users/:id/profile` returns phone, kycStatus, tier, buyerScore, sellerScore, isAdmin
- [x] Profile page renders the current user's data
- [x] Non-admin requests to `/api/admin/*` return 403
- [x] `GET /api/admin/users` lists users (admin only)
- [x] `tier` defaults to `None`; `buyerScore`/`sellerScore` default to 0
- [x] Vitest: profile shape, admin gate (admin allowed, non-admin denied, anonymous denied)

## Blocked by

02

## Comments

### Implementation — 2026-07-06

**Architecture decision (overrides ADR 0003 jsonb plan):** profile fields live in a dedicated `public.profiles` table (1:1 with `auth.users`, same `id`) rather than in `auth.users.user_metadata`. Typed columns make admin filter/sort/aggregate (#18) and future RLS policies (offer needs `kyc_status='Approved'`) straightforward. ADR 0003 amended with the rationale.

**Schema (`migrations/20260701051003_create-profiles.sql`):** `profiles(id → auth.users, phone, tier default 'None', kyc_status default 'None', buyer_score/seller_score default 0, is_admin/is_rider/is_hub_staff default false, hub_id null, created_at)`. RLS: select own-or-admin, insert/update own. `on_auth_user_created` trigger auto-creates a profile row on signup.

**Recursion fix (`migrations/20260706110120_fix-profiles-rls-recursion.sql`):** the first SELECT policy sub-queried `profiles` from within a `profiles` policy → `42P17` infinite recursion. Moved the admin check into a `SECURITY DEFINER` helper `public.is_current_admin()` (search_path pinned) so the inner read bypasses RLS. Both migration files carry the corrected policy.

**Admin gate:** `apps/web/app/lib/require-admin.ts` exposes `requireAdmin()` (returns 401/403/allow) backed by the pure `decideAdminGate()` for unit testing. Used by `/api/admin/users`.

**API:**
- `GET /api/users/[id]/profile` — own row or admin; 401 anonymous, 403 others.
- `GET /api/admin/users` — paginated list (page/pageSize, default 50, max 200), admin only.

**UI:** new `/profile` page (gradient header + KYC pill + admin badge + tier, sections for personal info / verification & roles / credit & scores). `/dashboard` now reads from `profiles` via `getCurrentUser()` and links to `/profile`.

**Config side-effect (pre-existing #02 bug surfaced):** disabled `require_email_verification` project-wide (`insforge.toml`, applied via `npx @insforge/cli config apply`). Phone OTP is the real verification gate; the synthetic `<phone>@phone.agrimarket` emails have no inbox, so the email-verification gate blocked every sign-in for users created before `autoConfirm` landed. Admin `0899999901` and `0812345678` were affected.

**Bug fix (pre-existing, blocking `pnpm build`):** `packages/database/src/index.ts` called `createClient({ apiKey })` — `apiKey` is not a valid `InsForgeConfig` field and `createClient` ignores it (no admin powers). Switched to `createAdminClient({ baseUrl, apiKey })` per the SDK contract. The web app never imports this package, so no runtime impact, but it unblocked `turbo build`.

**Backfill:** the 3 auth.users created before the trigger were inserted into `profiles` via `db query`; `0899999901` marked `is_admin=true` (`supabase/seed-admin.sql` documents the idempotent statement).

**Verified end-to-end (dev server + curl + browser):**
- anonymous → `/api/admin/users` and `/api/users/:id/profile` → 401 ✓
- non-admin → `/api/admin/users` → 403 ✓
- non-admin reading another user's profile → 403 ✓
- non-admin reading own profile → 200 ✓
- admin → `/api/admin/users` → 200 (paginated list) ✓
- admin reading any profile → 200 ✓
- `/dashboard` shows real tier/KYC/isAdmin from `profiles` ✓
- `/profile` renders all sections ✓
- `pnpm typecheck` + `pnpm build` (3 packages) ✓
- Vitest: 16 shared + 4 web = 20 tests green ✓

**Notes for downstream issues:**
- `getCurrentUser()` (`apps/web/app/lib/get-profile.ts`) is the canonical way to read the signed-in user's profile in any RSC / route handler.
- `requireAdmin()` is the canonical gate for `/api/admin/*`.
- `public.is_current_admin()` can be reused in future RLS policies that need an admin bypass.
