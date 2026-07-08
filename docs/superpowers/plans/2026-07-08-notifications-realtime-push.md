# Notifications: Realtime + Push — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the domain events emitted by earlier issues into the `notifications` table, deliver them to the connected user in realtime via InsForge, and expose a list/read API + bell + page UI.

**Architecture:** Two SQL migrations (add title/body columns; add realtime channel pattern + trigger) + pure logic in `@agrimarket/shared` (describe + recipients + schemas) + a thin `seedNotifications()` I/O helper consumed by 5 wired routes and 3 backfilled cron routes + 3 new API routes + a Client-side bell/page subscribing to a per-user realtime channel. A DB trigger auto-broadcasts every `notifications` insert via `realtime.publish()` so cron routes and wired routes share one delivery path.

**Tech Stack:** Next.js 15 App Router, `@insforge/sdk` (database + `@insforge/sdk/ssr` for the browser realtime client), Postgres raw SQL migrations, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-08-notifications-realtime-push-design.md`

**Repo conventions (read before starting):**
- No Prisma/BullMQ/NextAuth. DB access via `@insforge/sdk`; background jobs are InsForge managed cron hitting `/api/cron/*` routes.
- Service-role admin client: `createInsForgeAdminClient()` from `apps/web/app/lib/insforge-admin.ts` (bypasses RLS). Server-only.
- SSR client: `createInsForgeServerClient()` from `apps/web/app/lib/insforge-server.ts` (RLS-bounded).
- Browser client: `createBrowserClient()` from `apps/web/app/lib/insforge-client.ts` (already instantiated as `insforge`).
- Pure logic → `packages/shared/src/...` with co-located `*.test.ts`. Run `pnpm --filter @agrimarket/shared test`.
- PostgREST count idiom: `.select(col, { count: "exact", head: true })` then `destructure { count, error }`.
- DB inserts take an array: `insert([{ ... }])`.
- Commit to `master` directly (repo convention — do NOT create branches).

---

## Task 1: Migration — add title/body columns

**Files:**
- Create: `migrations/20260708160000_add-notifications-title-body.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Issue 17 — Notifications: add title + body text columns.
--
-- Issue 09 created public.notifications with (type, payload) only; #17 adds
-- title + body so the client renders Thai strings directly from the row
-- instead of mapping type → string in the browser. The columns are nullable
-- so the migration is non-breaking on existing rows (the cron routes are
-- edited in Task 7 to populate them going forward; legacy rows degrade with
-- a UI fallback "การแจ้งเตือน").
--
-- No NOT NULL constraint: the app layer (seedNotifications helper + zod)
-- always sets title/body on new inserts, and the DB constraint would force a
-- backfill of legacy rows with a guessed value. Mirrors the demands pattern
-- (constraint in the app, not the DB) and keeps the migration cheap.

alter table public.notifications
  add column if not exists title text,
  add column if not exists body  text;
```

- [ ] **Step 2: Commit**

```bash
git add migrations/20260708160000_add-notifications-title-body.sql
git commit -m "Add notifications title/body columns migration"
```

---

## Task 2: Shared — NotificationType + describeNotification

**Files:**
- Create: `packages/shared/src/notifications/types.ts`
- Create: `packages/shared/src/notifications/describe.ts`
- Create: `packages/shared/src/notifications/describe.test.ts`
- Create: `packages/shared/src/notifications/index.ts`
- Modify: `packages/shared/src/index.ts` (add barrel export)

- [ ] **Step 1: Write the failing test for describeNotification**

`packages/shared/src/notifications/describe.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  describeNotification,
  type NotificationType,
} from "./describe";
import { NotificationType as NotificationTypeEnum } from "./types";

describe("describeNotification", () => {
  it("returns title + body for offer.created", () => {
    expect(
      describeNotification(NotificationTypeEnum.OfferCreated, {
        productName: "มะม่วงน้ำดอกไม้",
      })
    ).toEqual({
      title: "มีข้อเสนอใหม่",
      body: "คุณมีข้อเสนอใหม่บนประกาศ มะม่วงน้ำดอกไม้",
    });
  });

  it("returns title + body for offer.seller_confirmed", () => {
    expect(
      describeNotification(NotificationTypeEnum.OfferSellerConfirmed, {
        productName: "ทุเรียน",
      })
    ).toEqual({
      title: "เกษตรกรยืนยันการขาย",
      body: "เกษตรกรยืนยันข้อเสนอบนประกาศ ทุเรียน",
    });
  });

  it("returns title + body for offer.seller_declined", () => {
    expect(
      describeNotification(NotificationTypeEnum.OfferSellerDeclined, {
        productName: "ทุเรียน",
      })
    ).toEqual({
      title: "เกษตรกรปฏิเสธการขาย",
      body: "เกษตรกรปฏิเสธข้อเสนอบนประกาศ ทุเรียน",
    });
  });

  it("returns title + body for demand.created (with quantity + unit)", () => {
    expect(
      describeNotification(NotificationTypeEnum.DemandCreated, {
        productName: "มะม่วง",
        quantity: 100,
        unit: "กก.",
      })
    ).toEqual({
      title: "มีประกาศรับซื้อใหม่",
      body: "มีคนรับซื้อ มะม่วง 100 กก.",
    });
  });

  it("returns title + body for counter_offer.received", () => {
    expect(
      describeNotification(NotificationTypeEnum.CounterOfferReceived, {
        productName: "มะม่วง",
        price: 80,
        unit: "กก.",
      })
    ).toEqual({
      title: "ผู้ซื้อส่งข้อเสนอกลับ",
      body: "ผู้ซื้อต้องการ มะม่วง ที่ราคา 80 บาท/กก.",
    });
  });

  it("returns title + body for demand.expired", () => {
    expect(
      describeNotification(NotificationTypeEnum.DemandExpired, {
        productName: "มะม่วง",
      })
    ).toEqual({
      title: "ประกาศหมดอายุ",
      body: "ประกาศ มะม่วง หมดอายุแล้ว",
    });
  });

  it("returns title + body for demand.completed", () => {
    expect(
      describeNotification(NotificationTypeEnum.DemandCompleted, {
        productName: "มะม่วง",
      })
    ).toEqual({
      title: "ประกาศเสร็จสิ้น",
      body: "ประกาศ มะม่วง เสร็จสิ้นแล้ว",
    });
  });

  it("returns title + body for offer.auto_declined", () => {
    expect(
      describeNotification(NotificationTypeEnum.OfferAutoDeclined, {
        productName: "มะม่วง",
      })
    ).toEqual({
      title: "ข้อเสนอหมดเวลา",
      body: "ข้อเสนอของคุณบน มะม่วง ถูกปฏิเสธอัตโนมัติ (เกิน 24 ชม.)",
    });
  });

  it("falls back to placeholder when payload field is missing", () => {
    expect(
      describeNotification(NotificationTypeEnum.OfferCreated, {})
    ).toEqual({
      title: "มีข้อเสนอใหม่",
      body: "คุณมีข้อเสนอใหม่บนประกาศ —",
    });
  });

  it("returns default for unknown type", () => {
    expect(
      describeNotification("unknown.type" as NotificationType, {})
    ).toEqual({
      title: "การแจ้งเตือน",
      body: "",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @agrimarket/shared test src/notifications/describe.test.ts`
Expected: FAIL — module `./describe` not found.

- [ ] **Step 3: Write `types.ts`**

`packages/shared/src/notifications/types.ts`:

```typescript
// Notification type vocabulary (Issue 17).
//
// type is plain text in the DB (no CHECK list — see the comment on
// migrations/20260707144511_create-notifications.sql); this enum is the
// single source of truth for the string values, shared between the routes
// (inserts) and the client (render).

export const NotificationType = {
  OfferCreated: "offer.created",
  OfferSellerConfirmed: "offer.seller_confirmed",
  OfferSellerDeclined: "offer.seller_declined",
  OfferAutoDeclined: "offer.auto_declined",
  DemandCreated: "demand.created",
  DemandExpired: "demand.expired",
  DemandCompleted: "demand.completed",
  CounterOfferReceived: "counter_offer.received",
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];
```

- [ ] **Step 4: Write `describe.ts`**

`packages/shared/src/notifications/describe.ts`:

```typescript
// Pure (type, payload) → { title, body } mapping (Issue 17).
//
// Thai user-facing strings. Missing payload fields fall back to "—" rather
// than throwing — a notification is best-effort and must never crash the
// route that emits it. An unknown type returns a safe default. Stack-
// agnostic; unit-tested here, consumed by seedNotifications() (server) and
// could be reused by the client (e.g. for legacy rows with null title/body).

import type { NotificationType } from "./types";

type Payload = Record<string, unknown>;

export function describeNotification(
  type: NotificationType,
  payload: Payload
): { title: string; body: string } {
  // Coerce common payload fields to strings with a "—" fallback so missing
  // data doesn't throw. Numbers are stringified; null/undefined → "—".
  const str = (key: string): string => {
    const v = payload[key];
    if (v === null || v === undefined) return "—";
    return String(v);
  };

  switch (type) {
    case "offer.created":
      return {
        title: "มีข้อเสนอใหม่",
        body: `คุณมีข้อเสนอใหม่บนประกาศ ${str("productName")}`,
      };
    case "offer.seller_confirmed":
      return {
        title: "เกษตรกรยืนยันการขาย",
        body: `เกษตรกรยืนยันข้อเสนอบนประกาศ ${str("productName")}`,
      };
    case "offer.seller_declined":
      return {
        title: "เกษตรกรปฏิเสธการขาย",
        body: `เกษตรกรปฏิเสธข้อเสนอบนประกาศ ${str("productName")}`,
      };
    case "offer.auto_declined":
      return {
        title: "ข้อเสนอหมดเวลา",
        body: `ข้อเสนอของคุณบน ${str("productName")} ถูกปฏิเสธอัตโนมัติ (เกิน 24 ชม.)`,
      };
    case "demand.created":
      return {
        title: "มีประกาศรับซื้อใหม่",
        body: `มีคนรับซื้อ ${str("productName")} ${str("quantity")} ${str("unit")}`,
      };
    case "demand.expired":
      return {
        title: "ประกาศหมดอายุ",
        body: `ประกาศ ${str("productName")} หมดอายุแล้ว`,
      };
    case "demand.completed":
      return {
        title: "ประกาศเสร็จสิ้น",
        body: `ประกาศ ${str("productName")} เสร็จสิ้นแล้ว`,
      };
    case "counter_offer.received":
      return {
        title: "ผู้ซื้อส่งข้อเสนอกลับ",
        body: `ผู้ซื้อต้องการ ${str("productName")} ที่ราคา ${str("price")} บาท/${str("unit")}`,
      };
    default:
      return { title: "การแจ้งเตือน", body: "" };
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @agrimarket/shared test src/notifications/describe.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Write `index.ts` barrel**

`packages/shared/src/notifications/index.ts`:

```typescript
export * from "./types";
export * from "./describe";
export * from "./recipients";
export * from "./schemas";
```

(`recipients` and `schemas` are created in Task 3 — the barrel can list them now; TypeScript will resolve them once those files exist. If typecheck is run between tasks, comment out the missing exports until Task 3 lands. **Simpler:** create this barrel at the end of Task 3 instead. For Task 2, only export what exists.)

**Revised — for Task 2, write the barrel as just:**

```typescript
export * from "./types";
export * from "./describe";
```

- [ ] **Step 7: Add the barrel export to `packages/shared/src/index.ts`**

Append after the existing Follow export block:

```typescript
// Notifications: type vocabulary + describeNotification() (Issue 17).
// Recipients/schemas are added in Task 3.
export * from "./notifications";
```

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/notifications/ packages/shared/src/index.ts
git commit -m "Add NotificationType + describeNotification"
```

---

## Task 3: Shared — recipients + zod schemas

**Files:**
- Create: `packages/shared/src/notifications/recipients.ts`
- Create: `packages/shared/src/notifications/recipients.test.ts`
- Create: `packages/shared/src/notifications/schemas.ts`
- Create: `packages/shared/src/notifications/schemas.test.ts`
- Modify: `packages/shared/src/notifications/index.ts` (add the two new exports)

- [ ] **Step 1: Write the failing test for demandCreatedRecipients**

`packages/shared/src/notifications/recipients.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { demandCreatedRecipients } from "./recipients";

const follows = [
  { userId: "u-seller-a", productId: "p-mango" },
  { userId: "u-seller-b", productId: "p-mango" },
  { userId: "u-seller-c", productId: "p-durian" },
];

describe("demandCreatedRecipients", () => {
  it("returns userIds of followers of the demand's product", () => {
    expect(
      demandCreatedRecipients(
        { productId: "p-mango", buyerId: "u-buyer" },
        follows
      )
    ).toEqual(["u-seller-a", "u-seller-b"]);
  });

  it("excludes other products' followers", () => {
    expect(
      demandCreatedRecipients(
        { productId: "p-durian", buyerId: "u-buyer" },
        follows
      )
    ).toEqual(["u-seller-c"]);
  });

  it("excludes the demand's own buyer if they happen to follow the product", () => {
    const withBuyerFollow = [
      ...follows,
      { userId: "u-buyer", productId: "p-mango" },
    ];
    expect(
      demandCreatedRecipients(
        { productId: "p-mango", buyerId: "u-buyer" },
        withBuyerFollow
      )
    ).toEqual(["u-seller-a", "u-seller-b"]);
  });

  it("returns [] when there are no followers", () => {
    expect(
      demandCreatedRecipients(
        { productId: "p-mango", buyerId: "u-buyer" },
        []
      )
    ).toEqual([]);
  });

  it("dedupes duplicate follows", () => {
    const dup = [
      { userId: "u-seller-a", productId: "p-mango" },
      { userId: "u-seller-a", productId: "p-mango" },
    ];
    expect(
      demandCreatedRecipients(
        { productId: "p-mango", buyerId: "u-buyer" },
        dup
      )
    ).toEqual(["u-seller-a"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @agrimarket/shared test src/notifications/recipients.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `recipients.ts`**

`packages/shared/src/notifications/recipients.ts`:

```typescript
// Recipient computation for notification fan-out (Issue 17).
//
// demandCreatedRecipients is the only fan-out: every other event type has a
// single recipient (the demand's buyer_id or one seller_id) that the route
// already knows. Pure — the route queries `follows` and passes the rows in,
// so this is unit-testable without a DB mock.

export function demandCreatedRecipients(
  demand: { productId: string; buyerId: string },
  follows: { userId: string; productId: string }[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of follows) {
    if (f.productId !== demand.productId) continue;
    if (f.userId === demand.buyerId) continue; // don't notify the actor
    if (seen.has(f.userId)) continue;
    seen.add(f.userId);
    out.push(f.userId);
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @agrimarket/shared test src/notifications/recipients.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing test for schemas**

`packages/shared/src/notifications/schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { notificationQuerySchema, notificationIdSchema } from "./schemas";

describe("notificationQuerySchema", () => {
  it("applies defaults for empty input", () => {
    expect(notificationQuerySchema.parse({})).toEqual({
      unreadOnly: false,
      limit: 20,
      cursor: undefined,
    });
  });

  it("coerces unreadOnly=true string from query params", () => {
    expect(
      notificationQuerySchema.parse({ unreadOnly: "true" }).unreadOnly
    ).toBe(true);
  });

  it("coerces limit number string", () => {
    expect(notificationQuerySchema.parse({ limit: "5" }).limit).toBe(5);
  });

  it("rejects limit below 1", () => {
    expect(() => notificationQuerySchema.parse({ limit: 0 })).toThrow();
  });

  it("rejects limit above 50", () => {
    expect(() => notificationQuerySchema.parse({ limit: 51 })).toThrow();
  });

  it("rejects non-iso cursor", () => {
    expect(() =>
      notificationQuerySchema.parse({ cursor: "not-a-date" })
    ).toThrow();
  });

  it("accepts a valid iso cursor", () => {
    const iso = "2026-07-08T12:00:00.000Z";
    expect(notificationQuerySchema.parse({ cursor: iso }).cursor).toBe(iso);
  });
});

describe("notificationIdSchema", () => {
  it("accepts a uuid", () => {
    expect(
      notificationIdSchema.parse({ id: "550e8400-e29b-41d4-a716-446655440000" })
    ).toEqual({ id: "550e8400-e29b-41d4-a716-446655440000" });
  });

  it("rejects a non-uuid", () => {
    expect(() => notificationIdSchema.parse({ id: "not-a-uuid" })).toThrow();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm --filter @agrimarket/shared test src/notifications/schemas.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Write `schemas.ts`**

`packages/shared/src/notifications/schemas.ts`:

```typescript
import { z } from "zod";

// Query params for GET /api/notifications (Issue 17). Coercion is for query-
// string values (all strings at the URL level) → typed values at the route
// level. Keyset pagination on (created_at, id) desc — `cursor` is an iso
// timestamp; rows with created_at strictly before it are returned.

export const notificationQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().datetime().optional(),
});

// Path param for POST /api/notifications/:id/read.
export const notificationIdSchema = z.object({
  id: z.string().uuid(),
});
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm --filter @agrimarket/shared test src/notifications/schemas.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 9: Extend the barrel — add recipients + schemas to index.ts**

`packages/shared/src/notifications/index.ts` — final form:

```typescript
export * from "./types";
export * from "./describe";
export * from "./recipients";
export * from "./schemas";
```

- [ ] **Step 10: Run the full shared suite + typecheck**

Run: `pnpm --filter @agrimarket/shared test`
Expected: all green (was 280; +10 describe + 5 recipients + 9 schemas = +24 → 304).

Run: `pnpm --filter @agrimarket/shared typecheck` (if present) or `pnpm -r typecheck`
Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/notifications/
git commit -m "Add notification recipients + zod schemas"
```

---

## Task 4: I/O helper — seedNotifications

**Files:**
- Create: `apps/web/app/lib/notifications.ts`

- [ ] **Step 1: Inspect the admin client type**

Read `apps/web/app/lib/insforge-admin.ts` (already shown in this plan's header notes). The return type of `createInsForgeAdminClient()` is `createAdminClient(...)` — type it as the inferred return; do NOT import a named `InsForgeAdminClient` type (it may not be exported). Use `ReturnType<typeof createInsForgeAdminClient>` if a named type isn't available.

- [ ] **Step 2: Write `notifications.ts`**

`apps/web/app/lib/notifications.ts`:

```typescript
import { describeNotification, type NotificationType } from "@agrimarket/shared";
import type { createInsForgeAdminClient } from "./insforge-admin";

// Server-only: never import into a Client Component.

type AdminClient = ReturnType<typeof createInsForgeAdminClient>;

export type NotificationInput = {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
};

// Bulk-insert notifications via the service-role admin client (bypasses RLS —
// the notifications table has no user INSERT policy; every write is a system-
// actor write, same as the Issue 09/15 cron routes). title/body are derived
// via describeNotification(). Empty input is a no-op.
//
// A failed insert is LOGGED, never thrown — mirrors the cron routes' rule:
// the state change (offer created, demand posted, etc.) already succeeded, so
// a missing notification is recoverable, not fatal. Returns void; callers do
// not branch on the outcome.
export async function seedNotifications(
  admin: AdminClient,
  inputs: NotificationInput[]
): Promise<void> {
  if (inputs.length === 0) return;

  const rows = inputs.map(({ userId, type, payload }) => {
    const { title, body } = describeNotification(type, payload);
    return { user_id: userId, type, title, body, payload };
  });

  const { error } = await admin.database.from("notifications").insert(rows);
  if (error) {
    console.error("[notifications] seed failed", {
      firstType: inputs[0]?.type,
      count: inputs.length,
      error,
    });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @agrimarket/web typecheck` (or `pnpm -r typecheck`)
Expected: clean. If `createInsForgeAdminClient`'s return type isn't inferable across the package boundary, switch the helper to accept the structurally-typed `{ database: { from(table: string): { insert(rows: unknown[]): Promise<{ error: unknown }> } } }` minimal shape — but try `ReturnType` first.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/lib/notifications.ts
git commit -m "Add seedNotifications I/O helper"
```

---

## Task 5: GET /api/notifications route

**Files:**
- Create: `apps/web/app/api/notifications/mapping.ts`
- Create: `apps/web/app/api/notifications/route.ts`

- [ ] **Step 1: Write `mapping.ts`**

`apps/web/app/api/notifications/mapping.ts`:

```typescript
// DB row ↔ API shape mappers for the notifications routes (Issue 17).
// Mirrors the demand/offer mapping pattern: snake_case DB → camelCase API.

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

// Columns selected from public.notifications. title/body may be null on
// legacy rows (inserted before Issue 17 added the columns); the client falls
// back to "การแจ้งเตือน" / "" when null.
export const NOTIFICATION_SELECT =
  "id, user_id, type, title, body, payload, read_at, created_at";

export function mapNotification(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title ?? "การแจ้งเตือน",
    body: row.body ?? "",
    payload: row.payload ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
```

- [ ] **Step 2: Write the route**

`apps/web/app/api/notifications/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { notificationQuerySchema } from "@agrimarket/shared";
import {
  NOTIFICATION_SELECT,
  mapNotification,
  type NotificationRow,
} from "./mapping";

// GET /api/notifications — the current user's inbox (Issue 17).
//
// Gate: 401 (no session) → 200. RLS owner-only filters automatically (the
// session user sees only their own rows via the notifications_select_own
// policy). Keyset pagination on (created_at, id) desc — the existing index
// notifications_user_created_idx covers it.
//
// Query: ?unreadOnly=true&limit=20&cursor=<iso>. unreadCount is computed in
// a second count-only request (head: true, count: "exact") so the bell badge
// and the list share one endpoint.

export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = notificationQuerySchema.safeParse({
    unreadOnly: url.searchParams.get("unreadOnly") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { unreadOnly, limit, cursor } = parsed.data;
  const client = await createInsForgeServerClient();

  // List query.
  let query = client.database
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", current.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1); // +1 to detect nextCursor

  if (unreadOnly) {
    query = query.is("read_at", null);
  }
  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as unknown as NotificationRow[];
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? slice[slice.length - 1]?.created_at ?? null
    : null;

  // Unread count (separate count-only request — always counts ALL unread for
  // the user, regardless of the list's unreadOnly filter).
  const { count, error: countErr } = await client.database
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", current.id)
    .is("read_at", null);

  if (countErr) {
    return NextResponse.json(
      { error: "Failed to count unread" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    notifications: slice.map(mapNotification),
    unreadCount: count ?? 0,
    nextCursor,
  });
}
```

- [ ] **Step 3: Typecheck + build smoke**

Run: `pnpm --filter @agrimarket/web typecheck`
Expected: clean. (If PostgREST's `.order("id", ...)` after `.order("created_at", ...)` is rejected by the SDK's chained types, drop the secondary order — the index is `(user_id, created_at desc)` and ties on `created_at` are rare; correctness is preserved by the keyset on `created_at`.)

Run: `pnpm --filter @agrimarket/web build`
Expected: succeeds; `/api/notifications` registered as a dynamic route.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/notifications/
git commit -m "Add GET /api/notifications route"
```

---

## Task 6: POST read + read-all routes

**Files:**
- Create: `apps/web/app/api/notifications/[id]/read/route.ts`
- Create: `apps/web/app/api/notifications/read-all/route.ts`

- [ ] **Step 1: Write the mark-one-read route**

`apps/web/app/api/notifications/[id]/read/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";

// POST /api/notifications/:id/read — mark one notification as read (Issue 17).
//
// Gate: 401 (no session) → 404 (not owner / not found — load first via .maybeSingle();
// a null row means either missing or someone else's, both surface as 404 to
// avoid existence leaks) → 200. Idempotent: marking an already-read row is 200.
//
// The UPDATE runs as the session user (RLS notifications_select_own is a
// SELECT policy; there is no UPDATE policy on the table — see the migration
// note in 20260707144511_create-notifications.sql). Because Issue 09 left no
// user UPDATE policy, this route must use the SSR client's UPDATE and rely on
// the row being visible to the SELECT policy: but UPDATE without a policy
// denies by default under RLS. **This route therefore uses the admin client
// for the UPDATE**, scoped by an explicit user_id check (the route first
// confirms ownership via a SELECT under the SSR client, then UPDATEs via the
// admin client with both id + user_id in the WHERE clause).

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  // Confirm ownership under the user's RLS — a null row is "not found" or
  // "not yours", both → 404 (no existence leak).
  const { data: existing, error: findErr } = await client.database
    .from("notifications")
    .select("id")
    .eq("id", id)
    .eq("user_id", current.id)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json(
      { error: "Failed to load notification" },
      { status: 500 }
    );
  }
  if (!existing) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 }
    );
  }

  // The admin client bypasses RLS for the UPDATE; the WHERE clause scopes it
  // to this user + this id (belt + suspenders with the ownership check above).
  const { createInsForgeAdminClient } = await import("@/app/lib/insforge-admin");
  const admin = createInsForgeAdminClient();
  const { error: updErr } = await admin.database
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", current.id);

  if (updErr) {
    return NextResponse.json(
      { error: "Failed to mark read" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write the read-all route**

`apps/web/app/api/notifications/read-all/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { getCurrentUser } from "@/app/lib/get-profile";

// POST /api/notifications/read-all — mark all of the current user's unread
// notifications as read (Issue 17). Used by the UI's "อ่านทั้งหมด" button.
//
// Gate: 401 → 200. Uses the admin client (same reason as the per-id route:
// the table has no user UPDATE policy). The WHERE clause scopes the UPDATE to
// this user's unread rows.

export async function POST() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createInsForgeAdminClient();
  const { error } = await admin.database
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", current.id)
    .is("read_at", null);

  if (error) {
    return NextResponse.json(
      { error: "Failed to mark all read" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Typecheck + build smoke**

Run: `pnpm --filter @agrimarket/web typecheck`
Expected: clean.

Run: `pnpm --filter @agrimarket/web build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/notifications/
git commit -m "Add POST read + read-all notification routes"
```

---

## Task 7: Migration — realtime channel + trigger

**Files:**
- Create: `migrations/20260708170000_notifications-realtime.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Issue 17 — Notifications realtime delivery via a DB trigger.
--
-- Every INSERT on public.notifications broadcasts a 'notification:new' event
-- to the owner's per-user channel ("notif:<user_id>"). This covers cron-route
-- inserts automatically (no need to edit the cron routes to publish) and
-- keeps the wired routes ignorant of realtime. Mirrors the insforge-cli
-- realtime reference's "publish from app-owned tables" pattern.
--
-- Channel RLS restricts subscription to the channel's owning user only.

-- 1. Channel pattern: one channel per user.
insert into realtime.channels (pattern, description, enabled)
values ('notif:%', 'Per-user notification inbox', true)
on conflict (pattern) do update
set description = excluded.description,
    enabled      = excluded.enabled;

-- 2. Channel RLS: a user may only subscribe to their own channel. Anonymous
--    callers have no auth.uid() and match nothing.
alter table realtime.channels enable row level security;

create policy "channels_select_own_notif"
  on realtime.channels for select
  to authenticated
  using (
    pattern = 'notif:%'
    and split_part(realtime.channel_name(), ':', 2)::uuid = auth.uid()
  );

-- 3. Trigger function: publish the new row to the owner's channel. SECURITY
--    DEFINER so the function runs as its owner (postgres), allowing it to
--    call realtime.publish() regardless of the inserting role (the inserts
--    come from the service-role admin client in cron routes + wired routes).
create or replace function public.notify_notification_inserted()
returns trigger as $$
begin
  perform realtime.publish(
    'notif:' || new.user_id::text,
    'notification:new',
    jsonb_build_object(
      'id',         new.id,
      'type',       new.type,
      'title',      new.title,
      'body',       new.body,
      'payload',    new.payload,
      'created_at', new.created_at
    )
  );
  return new;
end;
$$ language plpgsql security definer;

-- 4. Trigger: AFTER INSERT on public.notifications.
create trigger notifications_realtime_trigger
after insert on public.notifications
for each row
execute function public.notify_notification_inserted();
```

- [ ] **Step 2: Commit**

```bash
git add migrations/20260708170000_notifications-realtime.sql
git commit -m "Add notifications realtime trigger migration"
```

- [ ] **Step 3 (optional, deferred to live verification): apply the migration**

This is NOT run as part of the plan execution (needs the live backend + could affect prod). Note it in the issue file's "Verification ⏳" section instead. If a reviewer wants to apply locally:

```bash
npx @insforge/cli db migrations up
```

---

## Task 8: Wire events into 5 routes

**Files:**
- Modify: `apps/web/app/api/offers/route.ts` (offer.created → buyer)
- Modify: `apps/web/app/api/offers/[id]/confirm-sale/route.ts` (seller_confirmed → buyer)
- Modify: `apps/web/app/api/offers/[id]/decline-sale/route.ts` (seller_declined → buyer)
- Modify: `apps/web/app/api/demands/route.ts` (demand.created → followers fan-out)
- Modify: `apps/web/app/api/demands/[id]/counter-offer/route.ts` (counter_offer.received → sellers)

**Pattern for all five:** add `seedNotifications(admin, [...])` **after** the successful state change. Use `createInsForgeAdminClient()`. Wrap any extra lookups (buyer_id, product name, follows, sellers) in `try/catch` or check for errors so a lookup failure never breaks the main response — but do NOT swallow the main route's error path.

- [ ] **Step 1: Wire offer.created in `POST /api/offers`**

In `apps/web/app/api/offers/route.ts`, the POST handler currently selects the demand as `"id, status"`. Extend that select to also fetch `buyer_id` + the joined product name, then call `seedNotifications` right before the final `return NextResponse.json(..., { status: 201 })`.

Locate the demand select (around the line `select("id, status")`) and change it to:

```typescript
const { data: demand, error: demandErr } = await client.database
  .from("demands")
  .select("id, status, buyer_id, product:products(name)")
  .eq("id", demandId)
  .single();
```

The `demandRow` type assertion becomes:

```typescript
const demandRow = (demand as unknown as {
  id: string;
  status: string;
  buyer_id: string;
  product: { name: string };
} | null) ?? null;
```

Then, right before the **first** `return NextResponse.json({ offer: ... }, { status: 201 })` (the photo-refresh path) AND before the final fallback `return`, insert the notification seed. To avoid duplicating it in both return paths, hoist it just above the branching:

```typescript
// Issue 17: notify the demand's buyer that a new offer arrived. The state
// change (offer INSERT) already succeeded; a notification failure is logged,
// not thrown (seedNotifications handles that). Skipped if buyer_id or product
// name couldn't be loaded (defensive — they should always be present).
try {
  const { createInsForgeAdminClient } = await import("@/app/lib/insforge-admin");
  const { seedNotifications } = await import("@/app/lib/notifications");
  const { NotificationType } = await import("@agrimarket/shared");
  if (demandRow.buyer_id && demandRow.product?.name) {
    await seedNotifications(createInsForgeAdminClient(), [
      {
        userId: demandRow.buyer_id,
        type: NotificationType.OfferCreated,
        payload: { productName: demandRow.product.name },
      },
    ]);
  }
} catch (e) {
  console.error("[offers/POST] notification seed failed", e);
}
```

**Prefer static imports at the top of the file** over dynamic `await import(...)` — the dynamic form above is shown for clarity of placement; convert to top-of-file imports in the actual edit:

Add to the imports at the top:

```typescript
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { seedNotifications } from "@/app/lib/notifications";
import { NotificationType } from "@agrimarket/shared";
```

(`NotificationType` may already be imported via `acceptsOffers` etc. — merge into the existing `@agrimarket/shared` import line.)

Then the seed block simplifies to:

```typescript
try {
  if (demandRow.buyer_id && demandRow.product?.name) {
    await seedNotifications(createInsForgeAdminClient(), [
      {
        userId: demandRow.buyer_id,
        type: NotificationType.OfferCreated,
        payload: { productName: demandRow.product.name },
      },
    ]);
  }
} catch (e) {
  console.error("[offers/POST] notification seed failed", e);
}
```

Place this immediately after the offer's photo insert block, before the re-read + return.

- [ ] **Step 2: Wire offer.seller_confirmed in `POST /api/offers/:id/confirm-sale`**

In `apps/web/app/api/offers/[id]/confirm-sale/route.ts`, the route already loads the offer via `OFFER_SELECT` (which has `demand_id`). After the successful UPDATE to CONFIRMED, load the demand's `buyer_id` + product name, then seed.

Before the final `return NextResponse.json({ offer: ... })`, add:

```typescript
// Issue 17: notify the demand's buyer that the seller confirmed. The status
// flip already succeeded; notification failure is logged, not thrown.
try {
  const { data: d } = await client.database
    .from("demands")
    .select("buyer_id, product:products(name)")
    .eq("id", row.demand_id)
    .single();
  const demand = (d as unknown as { buyer_id: string; product: { name: string } } | null) ?? null;
  if (demand?.buyer_id && demand.product?.name) {
    await seedNotifications(createInsForgeAdminClient(), [
      {
        userId: demand.buyer_id,
        type: NotificationType.OfferSellerConfirmed,
        payload: { productName: demand.product.name },
      },
    ]);
  }
} catch (e) {
  console.error("[offers/confirm-sale] notification seed failed", e);
}
```

Add the imports at the top:

```typescript
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { seedNotifications } from "@/app/lib/notifications";
import { NotificationType } from "@agrimarket/shared";
```

- [ ] **Step 3: Wire offer.seller_declined in `POST /api/offers/:id/decline-sale`**

Identical to Step 2 but `type: NotificationType.OfferSellerDeclined` and the log tag `[offers/decline-sale]`. Same demand-lookup shape.

- [ ] **Step 4: Wire demand.created fan-out in `POST /api/demands`**

In `apps/web/app/api/demands/route.ts`, after the successful demand INSERT, query `follows` for the product, compute recipients via `demandCreatedRecipients`, and seed one notification per recipient.

Add imports at the top:

```typescript
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { seedNotifications } from "@/app/lib/notifications";
import {
  NotificationType,
  demandCreatedRecipients,
} from "@agrimarket/shared";
```

After the demand insert succeeds (and `row` is the created demand), before the `return NextResponse.json({ demand: mapDemand(row) }, { status: 201 })`, add:

```typescript
// Issue 17: fan-out — notify everyone following this product. buyer_id +
// product name are already on `row` (DEMAND_SELECT joins the product). The
// follow query + seed are best-effort: a failure is logged, not thrown.
try {
  const { data: followRows } = await client.database
    .from("follows")
    .select("user_id, product_id")
    .eq("product_id", row.product_id);

  const follows = ((followRows ?? []) as unknown as {
    userId?: string;
    user_id: string;
    productId?: string;
    product_id: string;
  }[]).map((f) => ({
    userId: f.user_id,
    productId: f.product_id,
  }));

  const recipients = demandCreatedRecipients(
    { productId: row.product_id, buyerId: row.buyer_id },
    follows
  );

  if (recipients.length > 0) {
    await seedNotifications(
      createInsForgeAdminClient(),
      recipients.map((userId) => ({
        userId,
        type: NotificationType.DemandCreated,
        payload: {
          productName: row.product.name,
          quantity: row.quantity,
          unit: row.product.unit,
        },
      }))
    );
  }
} catch (e) {
  console.error("[demands/POST] notification fan-out failed", e);
}
```

- [ ] **Step 5: Wire counter_offer.received in `POST /api/demands/:id/counter-offer`**

In `apps/web/app/api/demands/[id]/counter-offer/route.ts`, after the successful UPDATE of `counter_offer_price` + `counter_offer_at`, query the demand's sellers + product name, then seed one notification per distinct seller.

Add imports at the top:

```typescript
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { seedNotifications } from "@/app/lib/notifications";
import { NotificationType } from "@agrimarket/shared";
```

Before the final `return NextResponse.json({ demand: ... })`, add:

```typescript
// Issue 17: notify every seller with an offer on this demand that the buyer
// sent a counter-offer. The counter-offer UPDATE already succeeded; a
// notification failure is logged, not thrown.
try {
  const { data: offerRows } = await client.database
    .from("offers")
    .select("seller_id")
    .eq("demand_id", id);

  const sellerIds = Array.from(
    new Set(
      ((offerRows ?? []) as unknown as { seller_id: string }[]).map(
        (o) => o.seller_id
      )
    )
  );

  if (sellerIds.length > 0 && row.product?.name) {
    await seedNotifications(
      createInsForgeAdminClient(),
      sellerIds.map((sellerId) => ({
        userId: sellerId,
        type: NotificationType.CounterOfferReceived,
        payload: {
          productName: row.product.name,
          price: parsed.data.pricePerUnit,
          unit: row.product.unit,
        },
      }))
    );
  }
} catch (e) {
  console.error("[demands/counter-offer] notification seed failed", e);
}
```

- [ ] **Step 6: Typecheck + build**

Run: `pnpm --filter @agrimarket/web typecheck`
Expected: clean.

Run: `pnpm --filter @agrimarket/web build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/offers/route.ts apps/web/app/api/offers/[id]/confirm-sale/route.ts apps/web/app/api/offers/[id]/decline-sale/route.ts apps/web/app/api/demands/route.ts apps/web/app/api/demands/[id]/counter-offer/route.ts
git commit -m "Wire 5 notification events into routes"
```

---

## Task 9: Cron backfill — add title/body via helper

**Files:**
- Modify: `apps/web/app/api/cron/demands/expire/route.ts`
- Modify: `apps/web/app/api/cron/demands/complete/route.ts`
- Modify: `apps/web/app/api/cron/offers/decline/route.ts`

**Goal:** replace each route's inline `admin.database.from("notifications").insert([{ user_id, type, payload }])` with `seedNotifications(admin, [...])` so all notification writes share one shape (with title/body derived centrally).

- [ ] **Step 1: Backfill cron/demands/expire**

In `apps/web/app/api/cron/demands/expire/route.ts`, find the insert block (around line 68) and replace it.

Add imports at the top:

```typescript
import { seedNotifications } from "@/app/lib/notifications";
import { NotificationType } from "@agrimarket/shared";
```

Replace the insert:

```typescript
// BEFORE:
const { error: notifErr } = await admin.database.from("notifications").insert([
  {
    user_id: row.buyer_id,
    type: "demand.expired",
    payload: { demandId: row.id, productId: row.product_id, productName: row.product.name },
  },
]);
if (notifErr) { console.error(`[cron/demands/expire] notification ${row.id} failed`, notifErr); }

// AFTER:
await seedNotifications(admin, [
  {
    userId: row.buyer_id,
    type: NotificationType.DemandExpired,
    payload: {
      demandId: row.id,
      productId: row.product_id,
      productName: row.product.name,
    },
  },
]);
```

(`seedNotifications` logs internally; drop the local `if (notifErr)` block.)

- [ ] **Step 2: Backfill cron/demands/complete**

Same pattern in `apps/web/app/api/cron/demands/complete/route.ts` — replace the inline insert with `seedNotifications(admin, [{ userId: row.buyer_id, type: NotificationType.DemandCompleted, payload: { demandId, productId, productName } }])`. Add the same two imports.

- [ ] **Step 3: Backfill cron/offers/decline**

In `apps/web/app/api/cron/offers/decline/route.ts`, the payload has `offerId` + `demandId` + `productName`. Replace the inline insert with:

```typescript
await seedNotifications(admin, [
  {
    userId: row.seller_id,
    type: NotificationType.OfferAutoDeclined,
    payload: {
      offerId: row.id,
      demandId: row.demand?.id ?? null,
      productName,
    },
  },
]);
```

(`productName` is already computed as `row.demand?.product.name ?? null` earlier in the route — keep that line.) Add the same two imports.

- [ ] **Step 4: Typecheck + build + unit tests**

Run: `pnpm --filter @agrimarket/web typecheck`
Expected: clean.

Run: `pnpm --filter @agrimarket/web build`
Expected: succeeds.

Run: `pnpm --filter @agrimarket/shared test`
Expected: still 304 (unchanged — cron routes aren't unit-tested).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/cron/demands/expire/route.ts apps/web/app/api/cron/demands/complete/route.ts apps/web/app/api/cron/offers/decline/route.ts
git commit -m "Backfill cron notifications with title/body"
```

---

## Task 10: UI — NotificationsBell + List + page + TopNav wiring

**Files:**
- Create: `apps/web/app/components/notifications/NotificationsBell.tsx`
- Create: `apps/web/app/components/notifications/NotificationsList.tsx`
- Create: `apps/web/app/notifications/page.tsx`
- Modify: `apps/web/app/components/layout/TopNav.tsx` (replace the Bell placeholder)
- Modify: any page that renders `<TopNav/>` to pass `userId` (see Step 5)

- [ ] **Step 1: Write `NotificationsBell.tsx`**

`apps/web/app/components/notifications/NotificationsBell.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { insforge } from "@/app/lib/insforge-client";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

/**
 * Bell icon + unread badge + dropdown of the 5 most recent notifications.
 * Subscribes to the user's realtime channel ("notif:<userId>") so new rows
 * arrive instantly. The userId prop comes from the Server Component parent
 * (already-resolved), avoiding the "event arrives before auth hydrated"
 * race called out by the insforge realtime skill.
 */
export function NotificationsBell({ userId }: { userId: string }) {
  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const channel = `notif:${userId}`;
  const connectedRef = useRef(false);

  const loadRecent = useCallback(async () => {
    const res = await fetch("/api/notifications?limit=5");
    if (!res.ok) return;
    const json = (await res.json()) as {
      notifications: NotificationItem[];
      unreadCount: number;
    };
    setRecent(json.notifications);
    setUnread(json.unreadCount);
  }, []);

  useEffect(() => {
    void loadRecent();

    // Realtime: connect + subscribe + listen. The browser client reads the
    // access-token cookie and refreshes through /api/auth/refresh.
    const sub = async () => {
      try {
        await insforge.realtime.connect();
        const response = await insforge.realtime.subscribe(channel);
        if (!response.ok) return;
        connectedRef.current = true;

        insforge.realtime.on("notification:new", (payload: NotificationItem) => {
          setRecent((prev) => [payload, ...prev].slice(0, 5));
          setUnread((c) => c + 1);
        });
      } catch {
        // best-effort; the next route navigation will re-fetch via SSR.
      }
    };
    void sub();

    return () => {
      try {
        if (connectedRef.current) {
          insforge.realtime.unsubscribe(channel);
        }
      } catch {}
    };
  }, [channel, loadRecent]);

  const markRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setRecent((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: "read" } : n))
    );
    setUnread((c) => Math.max(0, c - 1));
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-surface text-ink"
        aria-label="แจ้งเตือน"
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 mt-2 z-50 bg-white border border-line rounded-xl shadow-md w-80 max-h-96 overflow-auto">
            {recent.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted text-center">
                ยังไม่มีการแจ้งเตือน
              </p>
            ) : (
              <>
                {recent.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void markRead(n.id)}
                    className={`block w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-surface ${
                      n.readAt ? "" : "bg-green-50/40"
                    }`}
                  >
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                  </button>
                ))}
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-green-700 hover:bg-surface text-center"
                >
                  ดูทั้งหมด
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `NotificationsList.tsx`**

`apps/web/app/components/notifications/NotificationsList.tsx`:

```tsx
"use client";

import { useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

/**
 * Full-page list with interactive mark-as-read. Receives the initial list from
 * the Server Component page (SSR fetch), then handles read mutations client-
 * side. "อ่านทั้งหมด" calls the read-all endpoint and flips every row locally.
 */
export function NotificationsList({
  initial,
}: {
  initial: NotificationItem[];
}) {
  const [items, setItems] = useState(initial);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: "read" } : n))
    );
  };

  const markAll = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setItems((prev) => prev.map((n) => ({ ...n, readAt: "read" })));
  };

  const hasUnread = items.some((n) => !n.readAt);

  return (
    <div className="space-y-3">
      {hasUnread && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={markAll}
            className="text-sm font-semibold text-green-700 hover:text-green-600"
          >
            อ่านทั้งหมด
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-center text-muted py-12">ยังไม่มีการแจ้งเตือน</p>
      ) : (
        items.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => !n.readAt && void markRead(n.id)}
            className={`block w-full text-left p-4 rounded-xl border border-line hover:bg-surface ${
              n.readAt ? "" : "bg-green-50/40"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{n.title}</p>
              {!n.readAt && (
                <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted mt-1">{n.body}</p>
            <p className="text-xs text-muted/70 mt-1">
              {new Date(n.createdAt).toLocaleString("th-TH")}
            </p>
          </button>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `/notifications` page**

`apps/web/app/notifications/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/get-profile";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { NotificationsList } from "@/app/components/notifications/NotificationsList";
import {
  NOTIFICATION_SELECT,
  mapNotification,
  type NotificationRow,
} from "@/app/api/notifications/mapping";

export default async function NotificationsPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const client = await createInsForgeServerClient();
  const { data } = await client.database
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", current.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as unknown as NotificationRow[];

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <TopNav isLoggedIn userName={current.phone} userId={current.id} />
      <main className="max-w-2xl mx-auto w-full px-4 md:px-8 py-8 flex-1">
        <h1 className="text-2xl font-bold text-ink mb-6">การแจ้งเตือน</h1>
        <NotificationsList initial={rows.map(mapNotification)} />
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 4: Wire `userId` into `TopNav`**

`apps/web/app/components/layout/TopNav.tsx` — add an optional `userId` prop. When present, render `<NotificationsBell userId={userId}/>` instead of the placeholder Bell link. Replace the existing Bell block (lines ~56-63):

```tsx
// BEFORE:
<Link
  href={isLoggedIn ? "/dashboard" : "/login"}
  className="relative p-2 rounded-lg hover:bg-surface text-ink"
  aria-label="แจ้งเตือน"
>
  <Bell size={20} aria-hidden="true" />
  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
</Link>

// AFTER:
{isLoggedIn && userId ? (
  <NotificationsBell userId={userId} />
) : (
  <Link
    href={isLoggedIn ? "/dashboard" : "/login"}
    className="relative p-2 rounded-lg hover:bg-surface text-ink"
    aria-label="แจ้งเตือน"
  >
    <Bell size={20} aria-hidden="true" />
  </Link>
)}
```

Add to the props signature:

```tsx
export function TopNav({
  isLoggedIn = false,
  userName = "",
  userId,
}: {
  isLoggedIn?: boolean;
  userName?: string;
  userId?: string;
}) {
```

Add the import:

```tsx
import { NotificationsBell } from "@/app/components/notifications/NotificationsBell";
```

- [ ] **Step 5: Pass `userId` from pages that render `<TopNav/>`**

Find all usages of `<TopNav isLoggedIn ...>` and add `userId={current.id}`:

```bash
grep -rln "TopNav isLoggedIn" apps/web/app
```

For each page (e.g. `dashboard/page.tsx`, `demands/page.tsx`, `demands/[id]/page.tsx`, `products/page.tsx`, `profile/page.tsx`, `admin/page.tsx`, etc.), change:

```tsx
<TopNav isLoggedIn userName={displayName} />
```
to:
```tsx
<TopNav isLoggedIn userName={displayName} userId={current.id} />
```

(Use the page's existing `current` variable; if a page names it differently, match the local name. Anonymous-login usages without `isLoggedIn` need no change.)

- [ ] **Step 6: Typecheck + build**

Run: `pnpm --filter @agrimarket/web typecheck`
Expected: clean.

Run: `pnpm --filter @agrimarket/web build`
Expected: succeeds; `/notifications` registered as a route.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/components/notifications/ apps/web/app/notifications/ apps/web/app/components/layout/TopNav.tsx
git commit -m "Add notifications bell + list + page UI"
```

Then a second commit for the TopNav callers:

```bash
git add apps/web/app
git commit -m "Pass userId to TopNav for notifications bell"
```

---

## Task 11: Integration tests + final verification

**Files:**
- Create: `apps/web/tests/notifications.integration.test.ts`
- Modify: `apps/web/package.json` (add `test:integration` script)

**Note:** integration tests need a running dev server + real backend. They run via a separate script (`test:integration`), NOT in the turbo `pnpm test` pipeline. Unit tests (`@agrimarket/shared`) cover the pure logic.

- [ ] **Step 1: Add the `test:integration` script**

In `apps/web/package.json`, add to `scripts`:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

Create `apps/web/vitest.integration.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.integration.test.ts"],
    environment: "node",
    testTimeout: 30000,
  },
});
```

- [ ] **Step 2: Write the integration test (skeleton)**

`apps/web/tests/notifications.integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";

// These tests require a running dev server (`pnpm --filter @agrimarket/web dev`)
// and a real InsForge backend. They are NOT part of `pnpm test` (turbo).
// Run manually: pnpm --filter @agrimarket/web test:integration
//
// The base URL + session cookie fixtures are environment-specific; this file
// documents the expected behaviour and the manual/CI harness is deferred to
// Issue 19 (E2E happy path). Each test below is a documented assertion the
// CI E2E will cover.

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

describe.skipIf(!process.env.RUN_INTEGRATION)("notifications integration", () => {
  beforeAll(async () => {
    // Fixtures (buyer + seller sessions) are provisioned by the Issue 19 E2E
    // harness. Here we only assert the contracts assuming a buyer session.
  });

  it("GET /api/notifications returns the inbox + unreadCount", async () => {
    // Seed 3 rows (2 unread, 1 read) via the admin client, then:
    const res = await fetch(`${BASE}/api/notifications`, {
      headers: { cookie: process.env.BUYER_COOKIE ?? "" },
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(json.notifications)).toBe(true);
    expect(typeof json.unreadCount).toBe("number");
    expect(typeof json.nextCursor).toBe("string");
  });

  it("GET ?unreadOnly=true hides read rows", async () => {
    const res = await fetch(`${BASE}/api/notifications?unreadOnly=true`, {
      headers: { cookie: process.env.BUYER_COOKIE ?? "" },
    });
    const json = await res.json();
    expect(json.notifications.every((n: { readAt: string | null }) => !n.readAt)).toBe(true);
  });

  it("POST /:id/read marks a row read", async () => {
    // Seed 1 unread, capture its id, POST read, refetch, assert readAt set.
    expect(true).toBe(true); // placeholder until Issue 19 harness lands
  });

  it("POST /read-all marks every unread row read", async () => {
    expect(true).toBe(true);
  });

  it("demand.created fans out to followers", async () => {
    // seed a follow, POST a demand, poll the follower's /api/notifications,
    // assert a demand.created row appears.
    expect(true).toBe(true);
  });

  it("realtime delivers a new notification", async () => {
    // subscribe to notif:<userId>, insert via admin, assert event arrives
    // within 5s via Promise.race against a timeout.
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 3: Run the unit suite (the real CI gate)**

Run: `pnpm --filter @agrimarket/shared test`
Expected: 304 passing.

Run: `pnpm -r typecheck`
Expected: clean across shared, database, web.

Run: `pnpm test` (turbo)
Expected: 5/5 tasks successful (typecheck × 3 + build + unit test × 2). Build registers `/api/notifications`, `/api/notifications/[id]/read`, `/api/notifications/read-all`, `/notifications`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/ apps/web/vitest.integration.config.ts apps/web/package.json
git commit -m "Add notifications integration test scaffold"
```

- [ ] **Step 5: Update the issue file + README**

In `docs/issues/agrimarket-mvp/17-notifications-realtime-push.md`:
- Change `Status: ready-for-agent` → `Status: done`.
- Append an "Implementation notes" section summarizing: 8 notification types wired, 2 migrations (title/body + realtime trigger), pure logic in `@agrimarket/shared/notifications`, `seedNotifications` helper, 3 new routes, bell + page UI, integration test scaffold (full live verification deferred to Issue 19).
- Add a "Verification ⏳" section with the manual checklist (apply migrations, boot dev server, curl the 3 endpoints with 2 sessions, browser-verify realtime badge bump).

In `docs/issues/agrimarket-mvp/README.md`:
- Change Issue 17 row from `ready-for-agent` → `done`.

- [ ] **Step 6: Commit**

```bash
git add docs/issues/agrimarket-mvp/17-notifications-realtime-push.md docs/issues/agrimarket-mvp/README.md
git commit -m "Mark Issue 17 notifications done"
```

---

## Self-review notes

**Spec coverage check:**
- Section 1 (schema migration) → Task 1 ✓
- Section 2 (pure logic: types, describe, recipients, schemas) → Tasks 2 + 3 ✓
- Section 3a (seedNotifications helper) → Task 4 ✓
- Section 3b (3 API routes) → Tasks 5 + 6 ✓
- Section 3c (5 wired routes) → Task 8 ✓
- Section 3d (cron backfill) → Task 9 ✓
- Section 4 (realtime migration) → Task 7 ✓
- Section 5 (UI: bell, list, page, TopNav wiring) → Task 10 ✓
- Section 6 (pure unit tests + integration scaffold) → Tasks 2/3 (unit) + 11 (integration) ✓

**Type consistency check:**
- `NotificationType` enum values match between `types.ts`, `describe.ts`, and every wired route (Task 8) ✓
- `NotificationInput` shape (`{ userId, type, payload }`) matches `seedNotifications` signature in Tasks 4, 8, 9 ✓
- `demandCreatedRecipients` signature `(demand, follows) → string[]` matches Task 8 Step 4 call site ✓
- `notificationQuerySchema`/`notificationIdSchema` used in Tasks 5/6 match Task 3 definitions ✓
- `NOTIFICATION_SELECT` + `mapNotification` used in Tasks 5 + 10 (page) match Task 5 mapping ✓

**Known deferrals (called out in spec):**
- Push (FCM/web push) — log-only stub (not implemented; `fcmToken` schema already exists for a later issue).
- CI wiring of `test:integration` — Issue 19 owns the E2E CI setup.
- Live curl verification — manual checklist in the issue file.
- Migration application (`db migrations up`) — deferred to live verification (both migrations are additive + safe).
