import { NextResponse } from "next/server";
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { shouldCompleteDemand, NotificationType } from "@agrimarket/shared";
import { DEMAND_SELECT, type DemandRow } from "@/app/api/demands/mapping";
import { seedNotifications } from "@/app/lib/notifications";

// POST /api/cron/demands/complete (Issue 09).
//
// Recurring auto-complete: flips MATCHED demands older than 7 days to
// COMPLETED, then seeds a 'demand.completed' notification for each buyer.
// Triggered by an InsForge managed cron schedule (`0 * * * *`) that POSTs this
// route with an X-Cron-Secret header — same system-actor shape as the expire
// route (admin client bypasses RLS, no user session).
//
// The 7-day cut lives in the pure predicate (COMPLETE_AFTER_MS), not in the
// SQL, so the constant is unit-tested and the query stays portable. SQL only
// pre-filters status='MATCHED'; the predicate re-checks updated_at per row.
//
// Idempotency mirrors expire: a row a prior tick already moved to COMPLETED is
// no longer MATCHED, so the next SELECT excludes it — no duplicate
// notifications on re-run.
export async function POST(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createInsForgeAdminClient();

  // Coarse filter in SQL — uses the existing demands_status_idx. We don't put
  // the 7-day cut in the WHERE clause: the predicate owns the threshold so it
  // can be unit-tested, and a MATCHED set is small enough that the per-row
  // re-check is cheap. DEMAND_SELECT pulls the joined product for the
  // notification payload.
  const { data, error } = await admin.database
    .from("demands")
    .select(DEMAND_SELECT)
    .eq("status", "MATCHED");

  if (error) {
    console.error("[cron/demands/complete] select failed", error);
    return NextResponse.json(
      { error: "Failed to load demands" },
      { status: 500 }
    );
  }

  const now = new Date();
  const rows = (data ?? []) as unknown as DemandRow[];
  // DemandRow columns are snake_case; the predicate speaks camelCase (shared
  // convention). Map the one field the predicate reads.
  const targets = rows.filter((row) =>
    shouldCompleteDemand(
      { status: row.status, updatedAt: row.updated_at },
      now
    )
  );

  let completed = 0;
  for (const row of targets) {
    const { error: updErr } = await admin.database
      .from("demands")
      .update({ status: "COMPLETED" })
      .eq("id", row.id);

    if (updErr) {
      console.error(
        `[cron/demands/complete] update ${row.id} failed`,
        updErr
      );
      continue;
    }

    await seedNotifications(admin, [
      {
        userId: row.buyer_id,
        type: NotificationType.DemandCompleted,
        payload: {
          demandId: row.id,
          productId: row.product_id,
          productName: row.product.name,
        },
      },
    ]);
    completed += 1;
  }

  console.info(`[cron/demands/complete] completed ${completed} demands`);
  return NextResponse.json({ completed });
}
