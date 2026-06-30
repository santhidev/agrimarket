Status: ready-for-agent

## What to build

Phone OTP registration + login using an **InsForge edge function** (InsForge's built-in auth has email/password + OAuth but no phone OTP — see ADR 0003). The edge function handles: `request-otp` (generate code, store with TTL, test mode `000000`) and `verify-otp` (validate, find-or-create user in `auth.users` via the SDK, issue an InsForge session). The Next.js app calls the edge function through `@insforge/sdk` `.functions.invoke()`. Login UI (phone → OTP → submit) + logout. Test mode OTP `000000`.

## Acceptance criteria

- [ ] InsForge edge function `request-otp` accepts phone, generates + stores OTP with TTL
- [ ] Edge function `verify-otp` validates; OTP `000000` always succeeds in test mode
- [ ] On success an InsForge session is issued; reload keeps the user logged in
- [ ] Find-or-create user by phone in `auth.users` (profile jsonb holds AgriMarket fields)
- [ ] Login page: phone input → request OTP → OTP input → login works end-to-end
- [ ] Logout works
- [ ] Edge-function unit tests: OTP generation/verify (test mode, wrong code, consumed code)

## Blocked by

01

## Comments

### Auth.js implementation — 2026-06-30 (superseded)

Initially implemented with Auth.js v5 (Credentials provider) + Redis OTP store. All criteria passed (16 Vitest tests green, full curl flow verified). See commit `9984a00`.

### Reverted to ready-for-agent — 2026-06-30 (InsForge migration)

The Auth.js + Redis implementation was removed per ADR 0003 (backend → InsForge BaaS). Re-opened because the new approach is an InsForge edge function (`@insforge/sdk` `.functions.invoke()`) which has not been written yet. The zod schemas in `packages/shared` and the login UI styles survive; the auth.ts/middleware/OTP service were deleted.
