# Issue 17 — Notifications: Realtime + Push — Design

**Date:** 2026-07-08
**Status:** Design (awaiting plan)
**Issue:** `docs/issues/agrimarket-mvp/17-notifications-realtime-push.md`

## Goal

Wire the domain events emitted by earlier issues (offer/confirm/decline/counter-
offer/demand-created-fan-out) into the `notifications` table and deliver them
to the connected user in realtime via InsForge. Expose a list + read API and a
notifications UI (bell + unread badge + page). Push (FCM/web push) remains a
log-only stub for MVP per the issue.

## Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| UI scope | API + notifications UI (bell + dropdown + `/notifications` page) |
| Realtime delivery | DB trigger → `realtime.publish()` (auto-broadcast on every insert) |
| Events | All 8 event types (5 new AC events wired into routes + 3 existing cron events backfilled with title/body) |
| Data shape | Add `title` + `body` text columns to `notifications` via migration |
| Testing | Pure logic unit tests in `@agrimarket/shared` + integration tests (real dev server + realtime subscribe) |
| Emission pattern | Pure logic (describe + recipients) in shared + thin `seedNotifications()` I/O helper; routes call the helper |

## Current state (what already exists)

- **`notifications` table** (`migrations/20260707144511_create-notifications.sql`,
  Issue 09): `id, user_id, type, payload, read_at, created_at`. Owner-only
  SELECT RLS. **No user INSERT/UPDATE/DELETE policy** — every write comes from
  the service-role admin client (cron routes). Indexed on
  `(user_id, created_at desc)`.
- **Cron jobs already seed notifications** (Issue 09 / 15):
  - `demand.expired` (cron/demands/expire)
  - `demand.completed` (cron/demands/complete)
  - `offer.auto_declined` (cron/offers/decline)
  Each insert is `admin.database.from("notifications").insert([{ user_id, type, payload }])`,
  logged-not-thrown on failure.
- **`follows` table** (Issue 16): `(user_id, product_id)` unique. Indexed on
  `product_id` (the fan-out lookup for demand-created). Owner-only insert/delete,
  owner-or-admin read.
- **5 `#17 NOTE` hook comments** left in routes as seams:
  - `POST /api/offers` (offer-created → buyer)
  - `POST /api/offers/:id/confirm-sale` (seller-confirmed → buyer)
  - `POST /api/offers/:id/decline-sale` (seller-declined → buyer)
  - `POST /api/demands` (demand-created → followers)
  - `POST /api/demands/:id/counter-offer` (counter-offer → sellers)
- **InsForge SDK browser client** already instantiated at
  `apps/web/app/lib/insforge-client.ts` via `createBrowserClient()` from
  `@insforge/sdk/ssr` — ready for realtime subscribe (reads the access-token
  cookie, refreshes through `/api/auth/refresh`).
- **No realtime usage anywhere** in the codebase today.

## Section 1 — Schema migration (title/body)

`migrations/20260708160000_add-notifications-title-body.sql`:

```sql
alter table public.notifications
  add column if not exists title text,
  add column if not exists body  text;
```

- `title`/`body` are **nullable** text — no NOT NULL so the migration is
  non-breaking on any existing rows; the app layer (zod + `seedNotifications`)
  always sets them on new inserts.
- Existing legacy rows (from Issue 09/15 cron, before this issue lands) may have
  null `title`/`body`; the UI falls back to `title ?? "การแจ้งเตือน"`.

**No backfill of existing rows.** The cron routes are edited (Section 3d) to
populate title/body going forward; legacy rows degrade gracefully.

## Section 2 — Pure logic in `@agrimarket/shared`

New folder `packages/shared/src/notifications/`:

### `types.ts`

```typescript
export const NotificationType = {
  OfferCreated:          "offer.created",
  OfferSellerConfirmed:  "offer.seller_confirmed",
  OfferSellerDeclined:   "offer.seller_declined",
  OfferAutoDeclined:     "offer.auto_declined",
  DemandCreated:         "demand.created",
  DemandExpired:         "demand.expired",
  DemandCompleted:       "demand.completed",
  CounterOfferReceived:  "counter_offer.received",
} as const;
export type NotificationType =
  typeof NotificationType[keyof typeof NotificationType];
```

### `describe.ts`

`describeNotification(type, payload) → { title, body }` — pure, Thai strings.

| type | title | body |
|---|---|---|
| `offer.created` | "มีข้อเสนอใหม่" | "คุณมีข้อเสนอใหม่บนประกาศ {productName}" |
| `offer.seller_confirmed` | "เกษตรกรยืนยันการขาย" | "เกษตรกรยืนยันข้อเสนอบนประกาศ {productName}" |
| `offer.seller_declined` | "เกษตรกรปฏิเสธการขาย" | "เกษตรกรปฏิเสธข้อเสนอบนประกาศ {productName}" |
| `demand.created` | "มีประกาศรับซื้อใหม่" | "มีคนรับซื้อ {productName} {quantity} {unit}" |
| `counter_offer.received` | "ผู้ซื้อส่งข้อเสนอกลับ" | "ผู้ซื้อต้องการ {productName} ที่ราคา {price} บาท/{unit}" |
| `demand.expired` | "ประกาศหมดอายุ" | "ประกาศ {productName} หมดอายุแล้ว" |
| `demand.completed` | "ประกาศเสร็จสิ้น" | "ประกาศ {productName} เสร็จสิ้นแล้ว" |
| `offer.auto_declined` | "ข้อเสนอหมดเวลา" | "ข้อเสนอของคุณบน {productName} ถูกปฏิเสธอัตโนมัติ (เกิน 24 ชม.)" |

Missing payload fields fall back to a placeholder (`"—"`) rather than throwing;
an unknown `type` returns `{ title: "การแจ้งเตือน", body: "" }` — safe default.

### `recipients.ts`

```typescript
// Fan-out for demand.created: given a demand + the follows for its product,
// return the recipient user ids. Pure — the route queries `follows` and passes
// the rows in; this function is unit-testable without a DB mock.
export function demandCreatedRecipients(
  demand: { productId: string },
  follows: { userId: string; productId: string }[]
): string[];
```

Other events have a single recipient (the buyer_id or one seller_id) that the
route already knows, so no helper is needed for them.

### `schemas.ts`

```typescript
// GET /api/notifications query
export const notificationQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional().default(false),
  limit:      z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor:     z.string().datetime().optional(), // created_at cursor (keyset)
});

// POST /api/notifications/:id/read, /read-all — path id
export const notificationIdSchema = z.object({ id: z.string().uuid() });
```

### Barrel + index export

`packages/shared/src/notifications/index.ts` re-exports all four; add
`export * from "./notifications";` to `packages/shared/src/index.ts`.

## Section 3 — I/O layer

### 3a. Shared I/O helper — `apps/web/app/lib/notifications.ts`

```typescript
import type { InsForgeAdminClient } from "@insforge/sdk";
import { describeNotification, type NotificationType } from "@agrimarket/shared";

type NotificationInput = {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
};

// Bulk-insert notifications via the service-role admin client (bypasses RLS —
// notifications are system-actor writes, not user-session writes, same as the
// cron routes). title/body are derived via describeNotification(). A failed
// insert is logged, never thrown — mirrors the cron routes' "notification is
// recoverable" rule: the state change already succeeded.
export async function seedNotifications(
  admin: InsForgeAdminClient,
  inputs: NotificationInput[]
): Promise<void>;
```

Empty input returns immediately. On insert error, logs `{ type, error }`.

### 3b. New API routes

**`GET /api/notifications`** — list + unread count.

- Gate: 401 (no session) → 200.
- Query: `?unreadOnly=true&limit=20&cursor=<iso>`.
- RLS owner-only filters automatically (the session user only sees their own).
- Keyset pagination on `(created_at, id)` desc using the existing index.
- Response: `{ notifications: NotificationRow[], unreadCount: number, nextCursor: string | null }`.

**`POST /api/notifications/:id/read`** — mark one read.

- Gate: 401 → 404 (not owner / not found, via `.single()` null-then-error) → 200.
- `UPDATE notifications SET read_at = now() WHERE id = :id AND user_id = auth.uid()`.
- Idempotent: an already-read row returns 200, not 409.

**`POST /api/notifications/read-all`** — mark all read (UI "อ่านทั้งหมด").

- Gate: 401 → 200.
- `UPDATE notifications SET read_at = now() WHERE user_id = auth.uid() AND read_at IS NULL`.
- Response: `{ updated: <count> }`.

### 3c. Wiring events into existing routes

Each route adds a `seedNotifications(admin, [...])` call **after** the state
change succeeds (never before — a notification failure must not roll back a
state change). Each uses `createInsForgeAdminClient()` for the insert (the
`notifications` table has no user INSERT policy, same as the cron routes).

| Route | Event | Recipient | Extra query |
|---|---|---|---|
| `POST /api/offers` | `offer.created` | demand's `buyer_id` | already loads demand (status check); also select `buyer_id` + product name |
| `POST /api/offers/:id/confirm-sale` | `offer.seller_confirmed` | demand's `buyer_id` | offer already loaded; select demand's buyer_id + product name |
| `POST /api/offers/:id/decline-sale` | `offer.seller_declined` | demand's `buyer_id` | same as confirm |
| `POST /api/demands` | `demand.created` | followers (fan-out) | select `follows` where `product_id`; pass rows to `demandCreatedRecipients()` |
| `POST /api/demands/:id/counter-offer` | `counter_offer.received` | sellers on demand | select `offers` where `demand_id` → `seller_id[]`; dedupe |

Don't notify the actor themselves (a buyer creating a demand isn't a follower of
their own product in practice, but the demand-created fan-out explicitly skips
`demand.buyer_id` if present in the recipient set).

### 3d. Cron backfill (3 existing routes)

Edit the three cron routes (`cron/demands/expire`, `cron/demands/complete`,
`cron/offers/decline`) to call `seedNotifications()` + `describeNotification()`
instead of their inline insert, so all six paths share one shape (with
title/body). Behaviour unchanged (logged-not-thrown on failure).

## Section 4 — Realtime delivery (DB trigger)

`migrations/20260708170000_notifications-realtime.sql`:

```sql
-- 1. Channel pattern: one channel per user — "notif:<user_id>"
insert into realtime.channels (pattern, description, enabled)
values ('notif:%', 'Per-user notification inbox', true)
on conflict (pattern) do update set enabled = true;

-- 2. Channel RLS: a user may only subscribe to their own channel
alter table realtime.channels enable row level security;
create policy channels_select_own
  on realtime.channels for select
  to authenticated
  using (
    pattern = 'notif:%'
    and split_part(realtime.channel_name(), ':', 2)::uuid = auth.uid()
  );

-- 3. Trigger: broadcast every insert on public.notifications to the owner's channel
create or replace function public.notify_notification_inserted()
returns trigger as $$
begin
  perform realtime.publish(
    'notif:' || new.user_id::text,
    'notification:new',
    jsonb_build_object(
      'id', new.id,
      'type', new.type,
      'title', new.title,
      'body', new.body,
      'payload', new.payload,
      'created_at', new.created_at
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger notifications_realtime_trigger
after insert on public.notifications
for each row
execute function public.notify_notification_inserted();
```

**Why DB trigger over server publish (for this repo):**

1. Covers the cron jobs automatically — they already insert; server-publish
   would require editing every cron to also publish.
2. Single source of truth — no path can forget to publish.
3. Matches the insforge-cli reference's recommendation for app-owned tables.
4. Routes stay ignorant of realtime — they only insert a notification row.

**Notes:**

- `security definer` is required so the trigger (running in the inserting role's
  context, which may be the service-role admin client from a cron route) can
  call `realtime.publish()`.
- The demand-created fan-out inserts N rows (one per follower); the trigger
  fires N times, each publishing one message to that user's own channel. This
  is the normal fan-out cost, not a broadcast-spam.
- `split_part(realtime.channel_name(), ':', 2)::uuid` matches the channel name
  against `auth.uid()` in RLS.

Apply via `npx @insforge/cli db migrations up`.

## Section 5 — Client UI

### Component tree

```
apps/web/app/
├── components/
│   ├── NotificationsBell.tsx     ('use client' — bell + unread badge + dropdown)
│   └── NotificationsList.tsx     ('use client' — list rows + mark-as-read)
├── notifications/
│   └── page.tsx                  (Server Component — full page, "อ่านทั้งหมด")
└── layout.tsx                    (render <NotificationsBell userId={...}/> when logged in)
```

### `NotificationsBell.tsx`

- Props: `{ userId: string }` (passed from the Server Component layout).
- On mount: `GET /api/notifications?limit=5` — the list response already
  includes `unreadCount`, so one fetch seeds both the recent list and the badge.
- Realtime:
  - `insforge.realtime.connect()`
  - `await insforge.realtime.subscribe('notif:' + userId)`
  - `.on('notification:new', (payload) => { bump unread; prepend to recent })`
- Click bell → dropdown shows the 5 recent + "ดูทั้งหมด" → `/notifications`.
- Click a row → `POST /api/notifications/:id/read` → mark read locally.
- Cleanup: `unsubscribe()`, `off(handler)`, `disconnect()` on unmount.

### Server → Client boundary

- `layout.tsx` (Server Component) resolves the current user via
  `getCurrentUser()`; if present, passes `userId` to `<NotificationsBell/>`.
  Anonymous users get no bell (no subscribe).
- The `userId` prop (not a client-side `getCurrentUser()`) avoids the
  "event arrives before auth hydrated" race called out by the insforge realtime
  skill.

### `/notifications` page

- Server Component fetches `GET /api/notifications?limit=50` via the SSR client.
- Renders `<NotificationsList>` (Client Component) for interactive mark-as-read.
- "อ่านทั้งหมด" button → `POST /api/notifications/read-all`.
- Rows: title + body + relative time ("2 นาทีที่แล้ว"); unread styled bold +
  dot, read styled faded. `title ?? "การแจ้งเตือน"` fallback for legacy rows.

## Section 6 — Testing

### Pure logic unit tests (`@agrimarket/shared`, co-located `*.test.ts`)

| File | Covers |
|---|---|
| `notifications/describe.test.ts` | Every `NotificationType` → correct title/body; missing payload field → fallback; unknown type → default |
| `notifications/recipients.test.ts` | `demandCreatedRecipients()`: followers present → userId[]; none → `[]`; dedupe; other products' follows excluded; buyer_id excluded if present |
| `notifications/schemas.test.ts` | `notificationQuerySchema` defaults/bounds/coercion/invalid cursor; `notificationIdSchema` uuid validation |

Run: `pnpm --filter @agrimarket/shared test`.

### Integration tests (`apps/web`)

New script `pnpm --filter @agrimarket/web test:integration` (separate from the
turbo `pnpm test` pipeline — needs a running dev server + real backend).

| Test | Steps | Assert |
|---|---|---|
| seed + trigger → realtime | subscribe channel → insert via admin | event arrives within timeout |
| `GET /api/notifications` | seed 3 (2 unread, 1 read); fetch | 3 rows, `unreadCount: 2`, desc order |
| `GET ?unreadOnly=true` | same seed | 2 rows |
| `POST /:id/read` | seed 1 unread; mark; refetch | `read_at` set, unread decremented |
| `POST /:id/read` (not owner) | seed user-A row; session-B mark | 404 (RLS hides) |
| `POST /read-all` | seed 3 unread; read-all | all `read_at` set |
| demand-created fan-out | seed follow; POST demand; poll follower's `/api/notifications` | `demand.created` row present |

Realtime tests use subscribe-then-insert + `Promise.race` against a timeout
(5s) to keep them deterministic-ish.

### CI

`pnpm test` (turbo: typecheck + build + unit) stays unchanged — integration
tests are opt-in (`test:integration`) because they need a live backend.
Acceptance criterion "runs green in CI" is fully satisfied by Issue 19's E2E,
which will cover the notification path end-to-end against docker-compose.

### Manual (deferred, like Issue 18)

Six-step live checklist goes in the issue file's "Verification ⏳" section:
curl the API endpoints with two sessions (buyer + seller), then browser-verify
the realtime badge bump across two tabs.

## Out of scope

- **Push (FCM/web push)** — log-only stub per the issue. The shared schema
  already has an optional `fcmToken` (`auth/schemas.ts`) for a later issue.
- **Notification preferences / mute** — Phase 2.
- **Email notifications** — InsForge `emails.send()` is available but out of
  scope for MVP notifications.
- **CI wiring of `test:integration`** — deferred to Issue 19 (E2E CI setup).
