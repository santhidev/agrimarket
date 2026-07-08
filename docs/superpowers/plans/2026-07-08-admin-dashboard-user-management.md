# Admin Dashboard + User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin dashboard (`/admin`) that surfaces 5 platform-health metrics and lets an admin search/filter users and set a user's credit tier.

**Architecture:** Two-layer split, identical to every prior issue. Pure metric math + zod schemas live in `@agrimarket/shared` (unit-tested); the I/O + RLS writes live in Next.js route handlers under `apps/web/app/api/admin/`. The `/admin` Server Component calls a shared loader (no HTTP round-trip); the interactive users table is a Client Component island.

**Tech Stack:** TypeScript, Next.js 15 App Router, `@insforge/sdk` (PostgREST-style database client), zod, vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-08-admin-dashboard-user-management-design.md`

---

## File Structure

**Create:**
- `packages/shared/src/admin/metrics.ts` — pure rate functions (`computeFulfillmentRate`, `computeTransactionSuccess`, `computeRepeatRate`, `DemandCounts`).
- `packages/shared/src/admin/metrics.test.ts` — unit tests for the three functions + zero-denominator edges.
- `packages/shared/src/admin/schemas.ts` — `userFilterSchema`, `setCreditTierSchema` (zod).
- `packages/shared/src/admin/schemas.test.ts` — unit tests for both schemas.
- `apps/web/app/api/admin/dashboard/load-dashboard.ts` — shared data loader (7 count queries + repeat-rate map → `AdminDashboardSnapshot`). Used by both the route and the page.
- `apps/web/app/api/admin/dashboard/route.ts` — `GET /api/admin/dashboard`, thin wrapper over the loader.
- `apps/web/app/api/admin/users/[id]/credit-tier/route.ts` — `PATCH`, admin gate, UPDATE via admin client.
- `apps/web/app/admin/page.tsx` — Server Component; metrics grid + `<UsersTable />`.
- `apps/web/app/admin/UsersTable.tsx` — Client Component; search/filter/pager + per-row set-tier.

**Modify:**
- `packages/shared/src/index.ts` — add `export * from "./admin/metrics"` and `"./admin/schemas"`.
- `apps/web/app/api/admin/users/route.ts` — add `search`/`kycStatus`/`tier` query params + return `total`.

**No migration, no storage bucket, no cron schedule.**

---

## Task 1: Pure metric functions

**Files:**
- Create: `packages/shared/src/admin/metrics.ts`
- Test: `packages/shared/src/admin/metrics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/admin/metrics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  computeFulfillmentRate,
  computeTransactionSuccess,
  computeRepeatRate,
  type DemandCounts,
} from "./metrics";

const all: DemandCounts = {
  open: 10,
  matched: 5,
  completed: 12,
  expired: 6,
  cancelled: 8,
}; // total = 41, terminal success = 17, terminal total = 31

describe("computeFulfillmentRate", () => {
  it("returns (matched + completed) / total when total > 0", () => {
    // (5 + 12) / 41
    expect(computeFulfillmentRate(all)).toBeCloseTo(17 / 41, 10);
  });

  it("returns 0 when every count is 0 (no demands)", () => {
    const empty: DemandCounts = {
      open: 0,
      matched: 0,
      completed: 0,
      expired: 0,
      cancelled: 0,
    };
    expect(computeFulfillmentRate(empty)).toBe(0);
  });

  it("is 0 when matched + completed are 0 but total is non-zero", () => {
    expect(computeFulfillmentRate({ ...all, matched: 0, completed: 0 })).toBe(0);
  });

  it("is 1 when every demand is matched or completed", () => {
    expect(
      computeFulfillmentRate({
        open: 0,
        matched: 3,
        completed: 7,
        expired: 0,
        cancelled: 0,
      })
    ).toBe(1);
  });

  it("treats negative counts as 0 (defensive, never negative)", () => {
    // negative matched shouldn't push the rate below 0
    const neg: DemandCounts = {
      open: 10,
      matched: -5,
      completed: 5,
      expired: 1,
      cancelled: 1,
    };
    expect(computeFulfillmentRate(neg)).toBeGreaterThanOrEqual(0);
    expect(computeFulfillmentRate(neg)).toBeLessThanOrEqual(1);
  });
});

describe("computeTransactionSuccess", () => {
  it("returns (matched + completed) / (matched + completed + expired + cancelled)", () => {
    // 17 / (17 + 6 + 8) = 17 / 31
    expect(computeTransactionSuccess(all)).toBeCloseTo(17 / 31, 10);
  });

  it("excludes OPEN from the denominator (unresolved)", () => {
    // open=10 doesn't change it vs all
    const noOpen: DemandCounts = {
      open: 0,
      matched: 5,
      completed: 12,
      expired: 6,
      cancelled: 8,
    };
    expect(computeTransactionSuccess(noOpen)).toBeCloseTo(17 / 31, 10);
  });

  it("returns 0 when no terminal demands exist", () => {
    const onlyOpen: DemandCounts = {
      open: 99,
      matched: 0,
      completed: 0,
      expired: 0,
      cancelled: 0,
    };
    expect(computeTransactionSuccess(onlyOpen)).toBe(0);
  });

  it("is 1 when every terminal demand matched or completed", () => {
    expect(
      computeTransactionSuccess({
        open: 5,
        matched: 2,
        completed: 3,
        expired: 0,
        cancelled: 0,
      })
    ).toBe(1);
  });
});

describe("computeRepeatRate", () => {
  it("returns buyersWith2Plus / totalBuyers", () => {
    expect(computeRepeatRate(10, 3)).toBeCloseTo(0.3, 10);
  });

  it("returns 0 when totalBuyers is 0", () => {
    expect(computeRepeatRate(0, 0)).toBe(0);
  });

  it("is 1 when every buyer has 2+ demands", () => {
    expect(computeRepeatRate(5, 5)).toBe(1);
  });

  it("is 0 when no buyer repeats", () => {
    expect(computeRepeatRate(8, 0)).toBe(0);
  });

  it("clamps negative inputs to a [0,1] rate", () => {
    expect(computeRepeatRate(-1, 0)).toBe(0);
    expect(computeRepeatRate(10, -3)).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @agrimarket/shared test -- src/admin/metrics.test.ts`
Expected: FAIL — `Cannot find module './metrics'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/src/admin/metrics.ts`:

```ts
// Admin dashboard metric calculations (Issue 18).
//
// These are PURE functions over raw counts the route loads from the DB. Keeping
// the math here (not in the route) means the edge cases — zero denominators,
// OPEN excluded from the transaction-success denominator — are unit-tested
// rather than proved by a live curl. The route's only job is to fetch the
// counts; this file decides what they mean.

/// Per-status demand counts. The route loads these with five `count: 'exact'`
/// queries against public.demands.
export interface DemandCounts {
  open: number;
  matched: number;
  completed: number;
  expired: number;
  cancelled: number;
}

// Clamp to [0, ∞) so a stray negative count can't make a rate negative.
function clampNonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/// Fulfillment rate = (matched + completed) / total. Top-of-funnel health: of
/// every demand ever posted, how many reached a deal. OPEN stays in the
/// denominator (it hasn't resolved yet). 0 when no demands exist.
export function computeFulfillmentRate(c: DemandCounts): number {
  const matched = clampNonNeg(c.matched);
  const completed = clampNonNeg(c.completed);
  const total =
    clampNonNeg(c.open) +
    matched +
    completed +
    clampNonNeg(c.expired) +
    clampNonNeg(c.cancelled);
  if (total === 0) return 0;
  return (matched + completed) / total;
}

/// Transaction success = (matched + completed) / terminal total. Of demands
/// that FINISHED (matched + completed + expired + cancelled), how many closed
/// well. OPEN is excluded — it hasn't finished. 0 when no terminal demands.
export function computeTransactionSuccess(c: DemandCounts): number {
  const matched = clampNonNeg(c.matched);
  const completed = clampNonNeg(c.completed);
  const expired = clampNonNeg(c.expired);
  const cancelled = clampNonNeg(c.cancelled);
  const terminal = matched + completed + expired + cancelled;
  if (terminal === 0) return 0;
  return (matched + completed) / terminal;
}

/// Repeat rate = buyersWith2Plus / totalBuyers. Buyer retention: of distinct
/// buyers, how many posted 2+ demands. 0 when there are no buyers.
export function computeRepeatRate(
  totalBuyers: number,
  buyersWith2Plus: number
): number {
  const tb = clampNonNeg(totalBuyers);
  const r = clampNonNeg(buyersWith2Plus);
  if (tb === 0) return 0;
  return Math.min(r / tb, 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @agrimarket/shared test -- src/admin/metrics.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Export from the package barrel**

Modify `packages/shared/src/index.ts`. Add these two lines after the existing offer block (after the `export * from "./offer/offer-jobs";` line, before the follow block):

```ts
// Admin: dashboard metric calculations (fulfillment rate, transaction success,
// repeat rate) + filter/validation schemas (Issue 18).
export * from "./admin/metrics";
export * from "./admin/schemas";
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/admin/metrics.ts packages/shared/src/admin/metrics.test.ts packages/shared/src/index.ts
git commit -m "Add admin dashboard metric functions"
```

---

## Task 2: Admin filter + set-tier schemas

**Files:**
- Create: `packages/shared/src/admin/schemas.ts`
- Test: `packages/shared/src/admin/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/admin/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { userFilterSchema, setCreditTierSchema } from "./schemas";
import { CreditTier, KycStatus } from "../users/enums";

describe("userFilterSchema", () => {
  it("accepts an empty query (all optional with defaults)", () => {
    const parsed = userFilterSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(50);
    expect(parsed.search).toBeUndefined();
    expect(parsed.kycStatus).toBeUndefined();
    expect(parsed.tier).toBeUndefined();
  });

  it("coerces page/pageSize from string", () => {
    const parsed = userFilterSchema.parse({ page: "3", pageSize: "25" });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(25);
  });

  it("accepts all four filters together", () => {
    const parsed = userFilterSchema.parse({
      search: "081234",
      kycStatus: KycStatus.Approved,
      tier: CreditTier.Gold,
      page: 2,
      pageSize: 20,
    });
    expect(parsed).toEqual({
      search: "081234",
      kycStatus: KycStatus.Approved,
      tier: CreditTier.Gold,
      page: 2,
      pageSize: 20,
    });
  });

  it("rejects an unknown kycStatus", () => {
    const parsed = userFilterSchema.safeParse({ kycStatus: "WHATEVER" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown tier", () => {
    const parsed = userFilterSchema.safeParse({ tier: "Platinum" });
    expect(parsed.success).toBe(false);
  });

  it("rejects page <= 0", () => {
    expect(userFilterSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(userFilterSchema.safeParse({ page: "-1" }).success).toBe(false);
  });

  it("caps pageSize at 200", () => {
    expect(userFilterSchema.safeParse({ pageSize: 201 }).success).toBe(false);
    expect(userFilterSchema.safeParse({ pageSize: 200 }).success).toBe(true);
  });

  it("trims search whitespace", () => {
    const parsed = userFilterSchema.parse({ search: "  081  " });
    expect(parsed.search).toBe("081");
  });

  it("rejects unknown keys (strict)", () => {
    const parsed = userFilterSchema.safeParse({ foo: "bar" });
    expect(parsed.success).toBe(false);
  });
});

describe("setCreditTierSchema", () => {
  it("accepts each valid tier", () => {
    for (const t of [CreditTier.None, CreditTier.Bronze, CreditTier.Silver, CreditTier.Gold]) {
      expect(setCreditTierSchema.safeParse({ tier: t }).success).toBe(true);
    }
  });

  it("rejects an unknown tier", () => {
    expect(setCreditTierSchema.safeParse({ tier: "Platinum" }).success).toBe(false);
  });

  it("rejects a missing tier", () => {
    expect(setCreditTierSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    expect(setCreditTierSchema.safeParse({ tier: CreditTier.Gold, extra: 1 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @agrimarket/shared test -- src/admin/schemas.test.ts`
Expected: FAIL — `Cannot find module './schemas'`. (Also the `index.ts` export added in Task 1 references `./admin/schemas`, which doesn't exist yet — that will surface as a typecheck error; both resolve here.)

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/src/admin/schemas.ts`:

```ts
import { z } from "zod";
import { CreditTier, KycStatus } from "../users/enums";

// Admin dashboard validation schemas (Issue 18).
//
// userFilterSchema validates the query string of GET /api/admin/users
// (search + kycStatus + tier + page + pageSize). setCreditTierSchema validates
// the body of PATCH /api/admin/users/:id/credit-tier. Both are strict so a typo
// in a param name fails loudly instead of being silently ignored.

/// Query params for GET /api/admin/users. `page` / `pageSize` coerce from the
/// string a URL gives us; the rest are enum-typed. `.strict()` rejects unknown
/// keys so a misspelled filter is a 400, not a silent no-op.
export const userFilterSchema = z
  .object({
    search: z.string().trim().optional(),
    kycStatus: z
      .enum([KycStatus.None, KycStatus.Pending, KycStatus.Approved, KycStatus.Rejected])
      .optional(),
    tier: z
      .enum([CreditTier.None, CreditTier.Bronze, CreditTier.Silver, CreditTier.Gold])
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(50),
  })
  .strict();

/// Body for PATCH /api/admin/users/:id/credit-tier. The single field is the new
/// credit tier; the route applies it via the service-role admin client (RLS
/// blocks admin UPDATEs on other users' profiles).
export const setCreditTierSchema = z
  .object({
    tier: z.enum([CreditTier.None, CreditTier.Bronze, CreditTier.Silver, CreditTier.Gold]),
  })
  .strict();

export type UserFilter = z.infer<typeof userFilterSchema>;
export type SetCreditTierInput = z.infer<typeof setCreditTierSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @agrimarket/shared test -- src/admin/schemas.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Run the full shared suite + typecheck**

Run: `pnpm --filter @agrimarket/shared test`
Expected: PASS — the prior baseline (253) plus 26 new (13 metrics + 13 schemas) = ~279.

Run: `pnpm --filter @agrimarket/shared typecheck`
Expected: PASS — no errors (the `index.ts` export added in Task 1 now resolves).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/admin/schemas.ts packages/shared/src/admin/schemas.test.ts
git commit -m "Add admin user-filter + set-tier schemas"
```

---

## Task 3: Dashboard data loader

**Files:**
- Create: `apps/web/app/api/admin/dashboard/load-dashboard.ts`

This is the shared snapshot both the route and the page consume. No unit test — it's pure I/O (PostgREST calls); the math it calls is unit-tested in Task 1, and a live verify exercises the loader end-to-end.

- [ ] **Step 1: Write the loader**

Create `apps/web/app/api/admin/dashboard/load-dashboard.ts`:

```ts
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import {
  computeFulfillmentRate,
  computeTransactionSuccess,
  computeRepeatRate,
  type DemandCounts,
} from "@agrimarket/shared";

// Admin dashboard snapshot (Issue 18). Shared between the GET route (which
// JSON-serializes it) and the /admin Server Component (which calls this
// directly, avoiding an HTTP round-trip). Pure metric math lives in
// @agrimarket/shared; this module only fetches counts and feeds them in.

export interface AdminDashboardSnapshot {
  totalUsers: number;
  totalDemands: number;
  fulfillmentRate: number;
  transactionSuccess: number;
  repeatRate: number;
  demandCounts: DemandCounts;
}

// PostgREST exposes no head-only count and no COUNT(DISTINCT). For the small MVP
// tables we (a) use select(..., { count: 'exact' }) with limit(0) to get a bare
// count, and (b) for repeat rate we pull buyer_id from every demand and tally
// distinct buyers in JS.
export async function loadAdminDashboard(): Promise<AdminDashboardSnapshot> {
  const client = await createInsForgeServerClient();

  // Run the per-status demand counts. PostgREST has no GROUP BY, so five
  // filtered counts are cheaper than loading every demand row.
  const [open, matched, completed, expired, cancelled, usersCount] =
    await Promise.all([
      countDemandsByStatus(client, "OPEN"),
      countDemandsByStatus(client, "MATCHED"),
      countDemandsByStatus(client, "COMPLETED"),
      countDemandsByStatus(client, "EXPIRED"),
      countDemandsByStatus(client, "CANCELLED"),
      countProfiles(client),
    ]);

  const demandCounts: DemandCounts = {
    open,
    matched,
    completed,
    expired,
    cancelled,
  };
  const totalDemands =
    open + matched + completed + expired + cancelled;

  // Repeat rate: pull every demand's buyer_id and count distinct + repeat
  // buyers in JS. (No COUNT(DISTINCT) over the API.)
  const { data: buyerRows } = (await client.database
    .from("demands")
    .select("buyer_id")) as { data: Array<{ buyer_id: string }> | null };
  const counts = new Map<string, number>();
  for (const r of buyerRows ?? []) {
    counts.set(r.buyer_id, (counts.get(r.buyer_id) ?? 0) + 1);
  }
  const totalBuyers = counts.size;
  const buyersWith2Plus = [...counts.values()].filter((n) => n >= 2).length;

  return {
    totalUsers: usersCount,
    totalDemands,
    fulfillmentRate: computeFulfillmentRate(demandCounts),
    transactionSuccess: computeTransactionSuccess(demandCounts),
    repeatRate: computeRepeatRate(totalBuyers, buyersWith2Plus),
    demandCounts,
  };
}

type CountResult = { count: number };

async function countDemandsByStatus(
  client: Awaited<ReturnType<typeof createInsForgeServerClient>>,
  status: string
): Promise<number> {
  const res = (await client.database
    .from("demands")
    .select("id", { count: "exact" })
    .eq("status", status)
    .limit(0)) as CountResult & { data: unknown };
  return res.count ?? 0;
}

async function countProfiles(
  client: Awaited<ReturnType<typeof createInsForgeServerClient>>
): Promise<number> {
  const res = (await client.database
    .from("profiles")
    .select("id", { count: "exact" })
    .limit(0)) as CountResult & { data: unknown };
  return res.count ?? 0;
}
```

- [ ] **Step 2: Typecheck the new file**

Run: `pnpm --filter @agrimarket/web typecheck`
Expected: PASS. (The file isn't imported anywhere yet — that's fine, `tsc --noEmit` still typechecks it.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/admin/dashboard/load-dashboard.ts
git commit -m "Add admin dashboard data loader"
```

---

## Task 4: Dashboard route

**Files:**
- Create: `apps/web/app/api/admin/dashboard/route.ts`

- [ ] **Step 1: Write the route**

Create `apps/web/app/api/admin/dashboard/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/require-admin";
import { loadAdminDashboard } from "./load-dashboard";

// GET /api/admin/dashboard — the 5 platform-health metrics (Issue 18).
//
// Admin-only (requireAdmin). Delegates the count queries + rate math to
// loadAdminDashboard, which the /admin Server Component also calls directly.
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: gate.status }
    );
  }

  try {
    const snapshot = await loadAdminDashboard();
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error("[admin/dashboard] load failed", err);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @agrimarket/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/admin/dashboard/route.ts
git commit -m "Add admin dashboard route"
```

---

## Task 5: Extend users list with search + filter

**Files:**
- Modify: `apps/web/app/api/admin/users/route.ts`

- [ ] **Step 1: Replace the route handler**

Replace the entire contents of `apps/web/app/api/admin/users/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { requireAdmin } from "@/app/lib/require-admin";
import { userFilterSchema } from "@agrimarket/shared";

// GET /api/admin/users — list profiles (admin only) with search + filter
// (Issue 18). Query: ?search=&kycStatus=&tier=&page=&pageSize=. search is a
// phone substring (ilike); kycStatus / tier are enum filters. Response carries
// `total` so the page can render a pager.
export async function GET(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: gate.status }
    );
  }

  const url = new URL(request.url);
  const parsed = userFilterSchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid user filter", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { search, kycStatus, tier, page, pageSize } = parsed.data;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const client = await createInsForgeServerClient();
  let query = client.database
    .from("profiles")
    .select(
      "id, phone, tier, kyc_status, buyer_score, seller_score, is_admin, is_rider, is_hub_staff, hub_id, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.ilike("phone", `%${search}%`);
  }
  if (kycStatus) {
    query = query.eq("kyc_status", kycStatus);
  }
  if (tier) {
    query = query.eq("tier", tier);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    id: string;
    phone: string;
    tier: string;
    kyc_status: string;
    buyer_score: number;
    seller_score: number;
    is_admin: boolean;
    is_rider: boolean;
    is_hub_staff: boolean;
    hub_id: string | null;
    created_at: string;
  }>;

  return NextResponse.json({
    page,
    pageSize,
    total: count ?? 0,
    users: rows.map((r) => ({
      id: r.id,
      phone: r.phone,
      tier: r.tier,
      kycStatus: r.kyc_status,
      buyerScore: r.buyer_score,
      sellerScore: r.seller_score,
      isAdmin: r.is_admin,
      isRider: r.is_rider,
      isHubStaff: r.is_hub_staff,
      hubId: r.hub_id,
      createdAt: r.created_at,
    })),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @agrimarket/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/admin/users/route.ts
git commit -m "Add search + filter to admin users list"
```

---

## Task 6: Set credit tier route

**Files:**
- Create: `apps/web/app/api/admin/users/[id]/credit-tier/route.ts`

- [ ] **Step 1: Write the route**

Create `apps/web/app/api/admin/users/[id]/credit-tier/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { requireAdmin } from "@/app/lib/require-admin";
import { setCreditTierSchema } from "@agrimarket/shared";

// PATCH /api/admin/users/:id/credit-tier — set a user's credit tier (Issue 18).
//
// Gate chain: 401/403 (admin gate) → 404 (target user missing) → 400 (bad body)
// → 200.
//
// The UPDATE uses the service-role admin client, NOT the SSR client. The
// profiles_update_own RLS policy has `with check (id = auth.uid())` and no
// admin clause, so an admin updating another user's row through the SSR client
// fails that check (the admin's auth.uid() != the target's). The migration
// comment says tier changes are "admin-only via the service client"; the admin
// gate has already authenticated + authorized the caller, so bypassing RLS for
// this single column is the sanctioned path. We read the updated row back
// through the SSR client so the response is RLS-visible.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: gate.status }
    );
  }

  const { id } = await params;
  const ssr = await createInsForgeServerClient();

  // 404 if the target user doesn't exist (or isn't RLS-visible to the admin —
  // but profiles_select_own_or_admin lets admins see all, so this is a true
  // existence check).
  const { data: existing, error: findErr } = await ssr.database
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json(
      { error: "Failed to load user" },
      { status: 500 }
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  const parsed = setCreditTierSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid credit tier", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Service-role UPDATE — bypasses RLS (see policy note above).
  const admin = createInsForgeAdminClient();
  const { error: updErr } = await admin.database
    .from("profiles")
    .update({ tier: parsed.data.tier })
    .eq("id", id);

  if (updErr) {
    console.error(`[admin/users/credit-tier] update for ${id} failed`, updErr);
    return NextResponse.json(
      { error: "Failed to set credit tier" },
      { status: 500 }
    );
  }

  // Read back through SSR so the response reflects the committed row.
  const { data: refreshed, error: refreshErr } = await ssr.database
    .from("profiles")
    .select(
      "id, phone, tier, kyc_status, buyer_score, seller_score, is_admin, is_rider, is_hub_staff, hub_id, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (refreshErr || !refreshed) {
    return NextResponse.json(
      { error: "Updated but failed to reload user" },
      { status: 500 }
    );
  }

  const r = refreshed as {
    id: string;
    phone: string;
    tier: string;
    kyc_status: string;
    buyer_score: number;
    seller_score: number;
    is_admin: boolean;
    is_rider: boolean;
    is_hub_staff: boolean;
    hub_id: string | null;
    created_at: string;
  };

  return NextResponse.json({
    user: {
      id: r.id,
      phone: r.phone,
      tier: r.tier,
      kycStatus: r.kyc_status,
      buyerScore: r.buyer_score,
      sellerScore: r.seller_score,
      isAdmin: r.is_admin,
      isRider: r.is_rider,
      isHubStaff: r.is_hub_staff,
      hubId: r.hub_id,
      createdAt: r.created_at,
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @agrimarket/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/api/admin/users/[id]/credit-tier/route.ts"
git commit -m "Add admin set credit tier route"
```

---

## Task 7: `/admin` page (Server Component)

**Files:**
- Create: `apps/web/app/admin/page.tsx`

- [ ] **Step 1: Write the page**

Create `apps/web/app/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { Users, FileText, TrendingUp, Repeat, CheckCircle } from "lucide-react";
import { getCurrentUser } from "@/app/lib/get-profile";
import { loadAdminDashboard } from "@/app/api/admin/dashboard/load-dashboard";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { Card } from "@/app/components/ui/Card";
import { UsersTable } from "./UsersTable";

// Admin dashboard (Issue 18). Non-admins are bounced to /dashboard. The metric
// snapshot is loaded server-side via the shared loader (no HTTP round-trip);
// the users table is a client island that fetches /api/admin/users.
export default async function AdminPage() {
  const current = await getCurrentUser();
  if (!current || !current.isAdmin) {
    redirect("/dashboard");
  }

  const snap = await loadAdminDashboard();
  const metrics = [
    { icon: Users, label: "ผู้ใช้ทั้งหมด", value: String(snap.totalUsers), sub: "คน" },
    { icon: FileText, label: "ประกาศรับซื้อ", value: String(snap.totalDemands), sub: "รายการ" },
    {
      icon: TrendingUp,
      label: "อัตราจับคู่สำเร็จ",
      value: pct(snap.fulfillmentRate),
      sub: "ของทุกประกาศ",
    },
    {
      icon: CheckCircle,
      label: "อัตราปิดดีล",
      value: pct(snap.transactionSuccess),
      sub: "ของที่จบแล้ว",
    },
    { icon: Repeat, label: "ผู้ซื้อซื้อซ้ำ", value: pct(snap.repeatRate), sub: "ของผู้ซื้อทั้งหมด" },
  ];

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <TopNav isLoggedIn userName={current.phone} />

      <header className="bg-green-700">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          <h1 className="text-white text-2xl font-bold">แดชบอร์ดผู้ดูแลระบบ</h1>
          <p className="text-white/80 text-sm mt-1">
            ภาพรวมสุขภาพแพลตฟอร์ม + จัดการผู้ใช้
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 md:px-8 py-8 space-y-8 flex-1">
        {/* Metrics */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {metrics.map(({ icon: Icon, label, value, sub }) => (
              <Card key={label} className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                    <Icon size={16} className="text-green-700" aria-hidden="true" />
                  </span>
                  <p className="text-xs font-medium text-muted leading-tight">{label}</p>
                </div>
                <p className="text-2xl font-bold text-ink tnum">{value}</p>
                <p className="text-xs text-muted mt-1">{sub}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Users management */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-ink">ผู้ใช้</h2>
          </div>
          <UsersTable />
        </section>
      </main>

      <Footer />
    </div>
  );
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @agrimarket/web typecheck`
Expected: FAIL — `UsersTable` doesn't exist yet. That's expected; Task 8 adds it. Do not commit yet.

---

## Task 8: Users table (Client Component)

**Files:**
- Create: `apps/web/app/admin/UsersTable.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/app/admin/UsersTable.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Input } from "@/app/components/ui/Input";
import { CreditTier, KycStatus } from "@agrimarket/shared";

type AdminUser = {
  id: string;
  phone: string;
  tier: string;
  kycStatus: string;
  buyerScore: number;
  sellerScore: number;
  isAdmin: boolean;
  createdAt: string;
};

type UsersResponse = {
  page: number;
  pageSize: number;
  total: number;
  users: AdminUser[];
};

const PAGE_SIZE = 20;

// Interactive users table for /admin (Issue 18). Owns its own search/filter
// state via URL-less local state (simpler than useSearchParams for v0), fetches
// /api/admin/users, and PATCHes /api/admin/users/:id/credit-tier on tier change.
export function UsersTable() {
  const [search, setSearch] = useState("");
  const [kycStatus, setKycStatus] = useState<string>("");
  const [tier, setTier] = useState<string>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (kycStatus) params.set("kycStatus", kycStatus);
    if (tier) params.set("tier", tier);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    try {
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as UsersResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [search, kycStatus, tier, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function setTierFor(userId: string, newTier: string) {
    const res = await fetch(`/api/admin/users/${userId}/credit-tier`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: newTier }),
    });
    if (!res.ok) {
      setError("ตั้ง tier ไม่สำเร็จ");
      return;
    }
    fetchUsers();
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Card className="p-4 md:p-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            placeholder="ค้นหาเบอร์โทร..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <select
          value={kycStatus}
          onChange={(e) => {
            setKycStatus(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-line rounded-xl bg-white"
        >
          <option value="">KYC: ทั้งหมด</option>
          <option value={KycStatus.None}>ยังไม่ยืนยัน</option>
          <option value={KycStatus.Pending}>รอตรวจสอบ</option>
          <option value={KycStatus.Approved}>ยืนยันแล้ว</option>
          <option value={KycStatus.Rejected}>ไม่ผ่าน</option>
        </select>
        <select
          value={tier}
          onChange={(e) => {
            setTier(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-line rounded-xl bg-white"
        >
          <option value="">Tier: ทั้งหมด</option>
          <option value={CreditTier.None}>สมาชิกใหม่</option>
          <option value={CreditTier.Bronze}>บรอนซ์</option>
          <option value={CreditTier.Silver}>เงิน</option>
          <option value={CreditTier.Gold}>ทอง</option>
        </select>
      </div>

      {error && <p className="text-sm text-error mb-3">{error}</p>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-line">
              <th className="py-2 pr-4 font-medium">เบอร์โทร</th>
              <th className="py-2 pr-4 font-medium">KYC</th>
              <th className="py-2 pr-4 font-medium">Tier</th>
              <th className="py-2 pr-4 font-medium">บทบาท</th>
              <th className="py-2 pr-4 font-medium">สมัครเมื่อ</th>
              <th className="py-2 font-medium">ตั้ง Tier</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  กำลังโหลด...
                </td>
              </tr>
            ) : data && data.users.length > 0 ? (
              data.users.map((u) => (
                <tr key={u.id} className="border-b border-line/60">
                  <td className="py-3 pr-4 font-medium text-ink tnum">{u.phone}</td>
                  <td className="py-3 pr-4 text-muted">{KYC_LABEL[u.kycStatus] ?? u.kycStatus}</td>
                  <td className="py-3 pr-4 text-muted">{TIER_LABEL[u.tier] ?? u.tier}</td>
                  <td className="py-3 pr-4 text-muted">{u.isAdmin ? "ผู้ดูแล" : "สมาชิก"}</td>
                  <td className="py-3 pr-4 text-muted tnum">
                    {new Date(u.createdAt).toLocaleDateString("th-TH")}
                  </td>
                  <td className="py-3">
                    <select
                      value={u.tier}
                      onChange={(e) => setTierFor(u.id, e.target.value)}
                      className="px-2 py-1 text-xs border border-line rounded-lg bg-white"
                    >
                      <option value={CreditTier.None}>สมาชิกใหม่</option>
                      <option value={CreditTier.Bronze}>บรอนซ์</option>
                      <option value={CreditTier.Silver}>เงิน</option>
                      <option value={CreditTier.Gold}>ทอง</option>
                    </select>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  ไม่พบผู้ใช้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted">
            {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} จาก {data.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-line disabled:opacity-40"
              aria-label="ก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-muted tnum">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg border border-line disabled:opacity-40"
              aria-label="ถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

const TIER_LABEL: Record<string, string> = {
  None: "สมาชิกใหม่",
  Bronze: "บรอนซ์",
  Silver: "เงิน",
  Gold: "ทอง",
};
const KYC_LABEL: Record<string, string> = {
  None: "ยังไม่ยืนยัน",
  Pending: "รอตรวจสอบ",
  Approved: "ยืนยันแล้ว",
  Rejected: "ไม่ผ่าน",
};
```

- [ ] **Step 2: Typecheck (both new files now exist)**

Run: `pnpm --filter @agrimarket/web typecheck`
Expected: PASS. If `Card` / `Input` prop names differ from what's used, check `apps/web/app/components/ui/Card.tsx` and `Input.tsx` and adjust the props to match (e.g. `className` passthrough).

- [ ] **Step 3: Commit (page + table together)**

```bash
git add apps/web/app/admin/page.tsx apps/web/app/admin/UsersTable.tsx
git commit -m "Add admin dashboard page"
```

---

## Task 9: Verify — full pipeline + manual curl notes

**Files:** none (verification only)

- [ ] **Step 1: Run the full shared test suite**

Run: `pnpm --filter @agrimarket/shared test`
Expected: PASS — ~279 tests (253 baseline + 13 metrics + 13 schemas).

- [ ] **Step 2: Typecheck the whole workspace**

Run: `pnpm -r typecheck`
Expected: PASS across shared, database, web.

- [ ] **Step 3: Run the full turbo pipeline**

Run: `pnpm test`
Expected: all tasks successful (typecheck + build + test).

- [ ] **Step 4: Manual live-verify (document, defer execution if no dev server)**

Start the dev server: `pnpm --filter @agrimarket/web dev`.

Then, with an admin session cookie (and a non-admin session for the 403 check):

1. `GET /api/admin/dashboard` → anon 401; non-admin 403; admin 200 with the 5-metric shape.
2. `GET /api/admin/users?search=08&kycStatus=Approved&tier=Gold&page=1&pageSize=20` → admin 200, filtered list, `total` present.
3. `GET /api/admin/users?kycStatus=BOGUS` → 400 with zod issues.
4. `PATCH /api/admin/users/:id/credit-tier -d '{"tier":"Gold"}'` → admin 200, response tier = Gold; non-admin 403.
5. `PATCH /api/admin/users/:id/credit-tier -d '{"tier":"Platinum"}'` → 400.
6. Visit `/admin` as admin → metrics grid + users table render; as non-admin → redirected to `/dashboard`.

Record results in the issue file's Implementation notes.

- [ ] **Step 5: Update issue file + README**

In `docs/issues/agrimarket-mvp/18-admin-dashboard-user-management.md`:
- Change `Status: ready-for-agent` → `Status: done`.
- Tick all 5 acceptance checkboxes.
- Append an `## Implementation notes (2026-07-08)` section summarizing what shipped, the metric formulas, the RLS/admin-client decision, and the verification status (link the spec).

In `docs/issues/agrimarket-mvp/README.md`:
- Change Issue 18's Status column from `ready-for-agent` → `done`.

- [ ] **Step 6: Final commit**

```bash
git add docs/issues/agrimarket-mvp/18-admin-dashboard-user-management.md docs/issues/agrimarket-mvp/README.md
git commit -m "Mark Issue 18 admin dashboard done"
```
