Status: done

## What to build

Demand lifecycle background jobs via BullMQ (Redis-backed, from docker-compose). Auto-expire: a recurring job (every 5 min) finds OPEN Demands whose deadline passed → EXPIRED. Auto-complete: a scheduled job finds MATCHED Demands older than 7 days → COMPLETED. Both update status + notify the buyer.

## Acceptance criteria

- [x] BullMQ worker bootstraps with the app (Redis connection)
- [x] OPEN demand past deadline → EXPIRED by the recurring job
- [x] MATCHED demand older than 7 days → COMPLETED by the scheduled job
- [x] Both transitions emit a notification event (consumed by 17 when ready; for now log/seed a `notifications` row)
- [x] Vitest: job logic (expire picks correct demands; complete picks correct demands; idempotent on re-run)

## Blocked by

07

---

## Implementation notes (2026-07-07)

Done. All acceptance criteria met, with one approved deviation (see below).

### Deviation: InsForge managed cron instead of BullMQ

The spec text says "BullMQ worker, Redis-backed." The user approved swapping
that for **InsForge managed cron** (`npx @insforge/cli schedules`) on
2026-07-07. Rationale: these two jobs are **pure cron** (wall-clock cadence,
no event queue), so managed cron removes an entire worker process +
`bullmq`/`ioredis` deps + restart/monitoring burden with no functional loss.
The acceptance criterion is reinterpreted as "recurring job bootstraps with
the app" — the InsForge schedule POSTs the route on the cron, so the job is
recurring and bootstrapped by the backend. Design spec at
`docs/superpowers/specs/2026-07-07-demand-auto-expire-complete-design.md`.

### What shipped

- **Shared package** (`packages/shared/src/demand/`):
  - `demand-jobs.ts` (new) — pure predicates `shouldExpireDemand(row, now)`
    (OPEN + deadline in the past) and `shouldCompleteDemand(row, now)`
    (MATCHED + updatedAt ≥ `COMPLETE_AFTER_MS` ago), plus the
    `COMPLETE_AFTER_MS = 7 * 24 * 60 * 60 * 1000` constant. Routes do the
    coarse filter in SQL, then re-check each row with these — the re-check is
    what makes a tick idempotent (a row that raced or already moved is
    skipped). Unparseable timestamps parse to NaN and skip safely.
  - 9 new unit tests (expire × 4, complete × 5, threshold × 1). Full shared
    suite 157 passed.
  - Exported from `packages/shared/src/index.ts`.
- **Migration** `20260707144511_create-notifications.sql` (new) —
  `public.notifications` table: `user_id`, `type` (text), `payload` (jsonb),
  `read_at`, `created_at`. RLS: owner-only SELECT
  (`notifications_select_own`); **no user INSERT/UPDATE/DELETE policy** —
  every write comes from the cron routes' service-role client. `type` is
  unconstrained text so #17 can add event kinds (offer.new, ...) without a
  migration.
- **API routes** (`apps/web/app/api/cron/demands/`):
  - `expire/route.ts` (new) — `POST`, gated by `X-Cron-Secret` header vs
    `process.env.CRON_SECRET`. Service-role admin client
    (`createInsForgeAdminClient`) bypasses RLS. SQL pre-filter
    `status='OPEN' AND deadline < now()` → predicate re-check → per-row
    UPDATE to EXPIRED + INSERT notification `('demand.expired', {demandId,
    productId, productName})`. Logs `[cron/demands/expire] expired N`. A row
    whose UPDATE fails is logged-and-continued (one bad row doesn't abort the
    tick); a failed notification INSERT is logged but non-fatal (the status
    flip already succeeded).
  - `complete/route.ts` (new) — same shape. SQL pre-filter `status='MATCHED'`
    (the 7-day cut lives in the predicate, not SQL, so the constant is
    unit-tested) → predicate re-check → UPDATE to COMPLETED + INSERT
    notification `('demand.completed', ...)`.
- **lib** `apps/web/app/lib/insforge-admin.ts` (new) — `createInsForgeAdminClient()`
  wraps `createAdminClient({ baseUrl, apiKey })` from `@insforge/sdk`. Throws
  if `NEXT_PUBLIC_INSFORGE_URL` or `INSFORGE_API_KEY` is missing. Server-only
  (the SSR client `insforge-server.ts` stays the user-scoped RLS-bounded path).

### Infrastructure (InsForge backend, not in repo)

- Secret `CRON_SECRET` — shared between the routes' `process.env.CRON_SECRET`
  (apps/web/.env.local, gitignored) and the schedule header
  `${{secrets.CRON_SECRET}}`.
- Schedule `Demand Expire` — cron `*/5 * * * *`, POST
  `/api/cron/demands/expire`, id `04f74458-948b-462e-b35a-10bc6574a0e8`.
- Schedule `Demand Complete` — cron `0 * * * *` (hourly, not daily — MATCHED
  set is small and hourly keeps auto-complete latency under an hour; the query
  is idempotent so the higher cadence costs nothing), POST
  `/api/cron/demands/complete`, id `e974f876-8eb3-474a-b430-0439b33c6d1a`.

Both schedules target the production URL and are active; they will return 404
until the routes are deployed (merge → deploy).

### Decisions worth recording

- **Why managed cron over BullMQ.** BullMQ's strength is an event-driven queue
  (offer auto-decline, push delivery, retries with backoff). The #09 jobs are
  pure wall-clock cadence — BullMQ would add a worker process + Redis dep +
  monitoring for no capability gain. If #17 (Push) or #10 (offer auto-decline)
  need event-driven work, revisit BullMQ then; for now the schedule → route
  → service-role-update loop is simpler and serverless.
- **Why complete runs hourly, not daily.** Spec says "scheduled job" without a
  cadence. Hourly keeps the MATCHED → COMPLETED latency under an hour at the
  cost of one near-empty query per hour; the query is idempotent so re-runs
  are free. Daily would let a demand sit MATCHED up to 7d23h before completing.
- **Why the 7-day cut lives in the predicate, not SQL.** `COMPLETE_AFTER_MS`
  is a constant the unit test asserts on (the `>=` boundary test at exactly 7
  days relies on it). Putting the cut in the SQL WHERE would make the constant
  untestable and the query less portable.
- **Why no INSERT policy on notifications.** The only writer is the cron job
  (service-role). Allowing user inserts would open a spam path (#17 may add a
  read API + a mark-read UPDATE, but never a user insert). RLS owner-SELECT is
  the only user-facing policy.
- **Why `type` is plain text, not a CHECK list.** #17 adds more event kinds
  (offer.new, offer.confirmed, ...). A CHECK list would force a migration per
  kind; plain text lets the shared vocabulary own the valid values.

### Idempotency + safety

- Re-running a tick after a successful one is a no-op: the prior UPDATE moved
  the row out of OPEN/MATCHED, so the next SELECT excludes it. **Verified
  live:** after a tick that expired 1 + completed 1, re-running both routes
  returned `{expired:0}` / `{completed:0}` and the notification count stayed
  at 2 (no duplicates).
- A row mid-race (buyer extended deadline between SELECT and UPDATE) is caught
  by the pure predicate re-check and skipped.
- 0-target tick returns `{expired:0}` / `{completed:0}` with 200 — not an
  error.

### Verification (live, against the dev DB)

- **Auth gate:** no secret → 401; wrong secret → 401 (both routes).
- **Expire happy path:** inserted an OPEN demand with a 2020 deadline, hit the
  route → `{expired:1}`; demand status flipped to EXPIRED; a `demand.expired`
  notification row seeded with the correct payload.
- **Complete happy path:** inserted a MATCHED demand, backdated `updated_at` to
  8 days ago, hit the route → `{completed:1}`; demand status flipped to
  COMPLETED; a `demand.completed` notification row seeded.
- **Idempotency:** re-ran both routes → `{expired:0}` / `{completed:0}`;
  notification count unchanged.
- Test data cleaned up (2 demands + 2 notifications deleted) after verify.

### Files

- `packages/shared/src/demand/demand-jobs.ts` (new)
- `packages/shared/src/demand/demand-jobs.test.ts` (new)
- `packages/shared/src/index.ts` (+export)
- `migrations/20260707144511_create-notifications.sql` (new, applied to dev DB)
- `apps/web/app/lib/insforge-admin.ts` (new)
- `apps/web/app/api/cron/demands/expire/route.ts` (new)
- `apps/web/app/api/cron/demands/complete/route.ts` (new)
- `apps/web/.env.local` (+`CRON_SECRET`, gitignored)
