Status: done

## What to build

Notifications foundation: an event bus + a `notifications` table (user_id, event_type, title, body, data, read_at) + realtime delivery (Socket.io or SSE) + a list endpoint (`GET /api/notifications`, `POST /api/notifications/:id/read`). Wire the events emitted by earlier issues: new offer on a demand → buyer; seller confirm/decline → buyer; new demand for a followed product → followers; counter-offer received → sellers. Push (FCM/web push) is a stub for MVP — log only; the realtime channel is the live path.

## Acceptance criteria

- [x] Domain events (offer-created, seller-confirmed/decline, demand-created, counter-offer) are caught and turned into `notifications` rows for the right recipients
- [x] `GET /api/notifications` lists a user's notifications; `POST /api/notifications/:id/read` marks read
- [x] Realtime channel pushes new notifications to the connected user
- [x] New Demand for a followed product notifies followers (consumes 16)
- [x] Vitest: event → notification mapping per recipient; read marking

## Blocked by

16

---

## Implementation notes

**Implemented 2026-07-08.** Spec: `docs/superpowers/specs/2026-07-08-notifications-realtime-push-design.md`. Plan: `docs/superpowers/plans/2026-07-08-notifications-realtime-push.md`.

### What shipped

- **2 migrations:**
  - `20260708160000_add-notifications-title-body.sql` — adds nullable `title` + `body` text columns (the table previously had only `type` + `payload`; the client now renders Thai strings directly from the row).
  - `20260708170000_notifications-realtime.sql` — creates the `notif:%` realtime channel pattern, a channel RLS policy (owner-only subscribe), and an AFTER INSERT trigger that calls `realtime.publish('notif:<user_id>', 'notification:new', ...)`. `SECURITY DEFINER` so the trigger runs as its owner when the insert comes from the service-role admin client.
- **Pure logic in `@agrimarket/shared/notifications/`:**
  - `NotificationType` enum (8 values: `offer.created`, `offer.seller_confirmed`, `offer.seller_declined`, `offer.auto_declined`, `demand.created`, `demand.expired`, `demand.completed`, `counter_offer.received`).
  - `describeNotification(type, payload) → { title, body }` — Thai strings, `"—"` fallback for missing payload fields, safe default for unknown types.
  - `demandCreatedRecipients(demand, follows) → string[]` — the only fan-out computation; excludes the demand's own buyer + dedupes.
  - `notificationQuerySchema` + `notificationIdSchema` (zod).
- **I/O helper `apps/web/app/lib/notifications.ts`:** `seedNotifications(admin, inputs[])` — bulk-inserts via the admin client (bypasses RLS; the table has no user INSERT policy), derives title/body via `describeNotification`, logs-not-throws on error (mirrors the cron routes' "recoverable" rule).
- **3 new API routes:**
  - `GET /api/notifications` — keyset pagination on `(created_at, id)` desc via the existing `notifications_user_created_idx`; second count-only request for `unreadCount`. Query: `?unreadOnly=true&limit=20&cursor=<iso>`.
  - `POST /api/notifications/:id/read` — owner-check via SSR client (`.maybeSingle()`), then admin UPDATE scoped by `id` + `user_id`. Idempotent. 404 for non-owner (no existence leak).
  - `POST /api/notifications/read-all` — admin UPDATE scoped by `user_id` + `read_at IS NULL`.
- **5 wired routes** (events emitted AFTER the state change, wrapped in `try/catch` so a notification failure never breaks the route): offer POST (`offer.created` → buyer), confirm-sale + decline-sale (`offer.seller_confirmed` / `seller_declined` → buyer), demand POST (`demand.created` → followers via `demandCreatedRecipients`), counter-offer (`counter_offer.received` → sellers).
- **3 cron routes backfilled** (`demand.expired`, `demand.completed`, `offer.auto_declined`) — switched from inline `admin.database.from("notifications").insert(...)` to `seedNotifications(...)` so all 6 notification paths share one shape (with title/body). Net -25 lines.
- **UI:** `NotificationsBell` (Client Component — bell + unread badge + dropdown of 5 recent, realtime subscribe to `notif:<userId>`), `NotificationsList` (Client Component — full-page list + mark-read + read-all), `/notifications` page (Server Component — SSR fetch of 50 rows). Wired into `TopNav` via a new optional `userId` prop (rendered for logged-in users only; anonymous users see the fallback Bell link). 5 pages updated to pass `userId` (protected pages use `current.id`; anonymous-browse-allowed pages use `current?.id`).

### Verification status

- ✅ `pnpm --filter @agrimarket/shared test` — **304 passed** (was 280; +10 describe + 5 recipients + 9 schemas).
- ✅ `pnpm -r typecheck` — clean (shared, database, web).
- ✅ `pnpm test` (turbo) — 5/5 tasks successful (typecheck × 3 + build + test × 2). Build registers `/api/notifications`, `/api/notifications/[id]/read`, `/api/notifications/read-all`, `/notifications`.
- ✅ Integration test scaffold at `apps/web/tests/notifications.integration.test.ts` + `vitest.integration.config.ts` + `test:integration` script. Guarded by `RUN_INTEGRATION` env var; NOT part of the turbo pipeline. Full live wiring + CI harness deferred to Issue 19.
- ⏳ **Live verification — NOT run.** Needs a running dev server + applied migrations + an admin/user session. Manual checklist below.

### Verification ⏳ (manual, before marking fully verified)

1. Apply both new migrations to the live backend: `npx @insforge/cli db migrations up` (also applies any pending prior migrations — see the prior handoff's deferred items).
2. Boot the dev server: `pnpm --filter @agrimarket/web dev`.
3. As a buyer, `curl -b cookie.txt http://localhost:3000/api/notifications` — expect `{ notifications: [], unreadCount: 0, nextCursor: null }`.
4. As a seller (KYC approved), submit an offer on the buyer's demand; as the buyer, re-fetch — expect one `offer.created` row, `unreadCount: 1`.
5. `POST /api/notifications/<id>/read` as the buyer; refetch — expect `readAt` set, `unreadCount: 0`.
6. Open the buyer's `/notifications` page in two browser tabs; in a third tab (as the seller) submit another offer — the buyer's bell badge should bump in both tabs via realtime.
