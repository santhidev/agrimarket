# Issue #09 — Demand Auto-Expire + Auto-Complete

**Date:** 2026-07-07
**Spec for:** `docs/issues/agrimarket-mvp/09-demand-auto-expire-complete.md`
**Status:** Approved (user confirmed 2026-07-07)

## Goal

Demand lifecycle background jobs: auto-**expire** OPEN demands whose deadline
passed → EXPIRED; auto-**complete** MATCHED demands older than 7 days →
COMPLETED. Both update status + seed a `notifications` row for the buyer.

## Trigger: InsForge managed cron (NOT BullMQ)

Deviation from the spec text ("BullMQ worker, Redis-backed") — approved by the
user on 2026-07-07.

**Why:** InsForge ships a managed cron scheduler
(`npx @insforge/cli schedules create`) that POSTs an API route on a cron
expression. These two jobs are **pure cron** (wall-clock cadence, no event
queue), so managed cron removes an entire worker process + `bullmq`/`ioredis`
deps + restart/monitoring burden with no functional loss. Logic that would have
lived in a BullMQ processor lives in the route handler instead, identical test
surface.

**Schedules** (created via CLI, not committed to the repo):

| Name              | Cron         | Target                                   |
| ----------------- | ------------ | ---------------------------------------- |
| Demand expire     | `*/5 * * * *`| `POST /api/cron/demands/expire`          |
| Demand complete   | `0 * * * *`  | `POST /api/cron/demands/complete`        |

Complete runs hourly rather than daily: the 7-day-MATCHED set is small, the
query is idempotent, and hourly keeps auto-complete latency under an hour.
(Spec says "scheduled job"; hourly is still scheduled — the cadence is ours to
choose.)

**Auth:** routes accept a header `X-Cron-Secret: <CRON_SECRET>` checked against
`process.env.CRON_SECRET`. The InsForge schedule passes the secret via
`${{secrets.CRON_SECRET}}` in its header JSON. Not user auth — the job is a
system actor.

**DB access:** `createAdminClient({ apiKey: INSFORGE_API_KEY })` — service-role,
bypasses RLS. Required because cron has no user context and must UPDATE demands
belonging to every buyer.

## Pure job logic (TDD, in `@agrimarket/shared`)

New file `packages/shared/src/demand/demand-jobs.ts` + `.test.ts`.

```ts
export const COMPLETE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldExpireDemand(
  row: { status: string; deadline: string },
  now: Date
): boolean;

export function shouldCompleteDemand(
  row: { status: string; updatedAt: string },
  now: Date
): boolean;
```

- `shouldExpireDemand`: `status === 'OPEN'` AND `Date.parse(deadline) < now`.
  Unparseable deadline compares false → safe skip.
- `shouldCompleteDemand`: `status === 'MATCHED'` AND
  `now - Date.parse(updatedAt) >= COMPLETE_AFTER_MS`.

**Why predicates separate from the SQL filter:** the route does the coarse
filter in SQL (uses the existing `demands_status_idx`), then re-checks each row
with the pure predicate before UPDATE. A row that slipped through a race (e.g.
the buyer extended the deadline between SELECT and UPDATE) is skipped — every
tick is idempotent.

## notifications table (new migration)

`migrations/<ts>_create-notifications.sql`:

```sql
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid());
```

- `type` values here: `'demand.expired'`, `'demand.completed'`. Unconstrained
  text so #17 can add more without a migration.
- `payload` jsonb carries `{ demandId, productId, productName }`.
- **No INSERT/UPDATE policy for users.** All writes come from the cron routes'
  service-role client (bypasses RLS). #17 adds a read API + UI; this issue only
  seeds rows.

## Route shape

Both routes share the same skeleton:

```ts
export async function POST(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient({ ... });
  const { data, error } = await admin.database.from("demands").select(...)...;
  if (error) return NextResponse.json({ error: "..." }, { status: 500 });

  const targets = (data ?? []).filter(row => shouldX(row, new Date()));
  // UPDATE + INSERT notification per target (or bulk after)
  return NextResponse.json({ <expired|completed>: targets.length });
}
```

Expire route:
`SELECT id, buyer_id, product_id, status, deadline FROM demands WHERE status='OPEN' AND deadline < now()`
→ filter via `shouldExpireDemand` → per-row `UPDATE ... SET status='EXPIRED'` +
notification insert `('demand.expired', { demandId, productId, productName })`.

Complete route:
`SELECT id, buyer_id, product_id, status, updated_at FROM demands WHERE status='MATCHED'`
→ filter via `shouldCompleteDemand` (the 7-day cut lives in the predicate so the
SQL stays portable and the constant is unit-tested) → per-row
`UPDATE ... SET status='COMPLETED'` + notification `('demand.completed', ...)`.

## Idempotency + safety

- Re-running a tick after a successful one is a no-op: the prior UPDATE moved
  the row out of OPEN/MATCHED, so the next SELECT excludes it. No duplicate
  notifications.
- A row mid-race (buyer extended deadline between SELECT and UPDATE) is caught
  by the pure predicate re-check and skipped.
- 0-target tick returns `{ expired: 0 }` / `{ completed: 0 }` with 200 — not an
  error.

## Test matrix (vitest, pure logic only)

`shouldExpireDemand`:
- OPEN + past deadline → true
- OPEN + future deadline → false
- MATCHED/COMPLETED/EXPIRED/CANCELLED + past deadline → false
- unparseable deadline → false

`shouldCompleteDemand`:
- MATCHED + 8 days old → true
- MATCHED + 6 days old → false
- MATCHED + exactly 7 days → true (`>=`)
- COMPLETED/OPEN + old → false
- unparseable updatedAt → false

Idempotency: a row already past its transition (`status` no longer OPEN /
MATCHED) is rejected by the predicate → re-run is a no-op.

## Files

| File                                                       | Action  |
| ---------------------------------------------------------- | ------- |
| `packages/shared/src/demand/demand-jobs.ts`                | new     |
| `packages/shared/src/demand/demand-jobs.test.ts`           | new     |
| `packages/shared/src/index.ts`                             | +export |
| `migrations/<ts>_create-notifications.sql`                 | new     |
| `apps/web/app/lib/insforge-admin.ts`                       | new     |
| `apps/web/app/api/cron/demands/expire/route.ts`            | new     |
| `apps/web/app/api/cron/demands/complete/route.ts`          | new     |
| `.env.local`                                               | +`CRON_SECRET` |

Out-of-repo (CLI): InsForge secret `CRON_SECRET` + two schedules.

## Build sequence

1. shared predicates + tests (TDD) → `pnpm --filter @agrimarket/shared build`
2. migration `notifications` + create `insforge-admin.ts` lib
3. expire route → complete route (mirror shape)
4. set `CRON_SECRET` locally + create InsForge secret + two schedules
5. verify: `curl -X POST -H "X-Cron-Secret: ..."` each route; `schedules logs`

## Out of scope

- Push notifications / realtime delivery (#17).
- notifications read API + UI (#17).
- offer auto-decline at 24h (#10's offer table doesn't exist yet).
- BullMQ / Redis worker — explicitly not used this issue.
