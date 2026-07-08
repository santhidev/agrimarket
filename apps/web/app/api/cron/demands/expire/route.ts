import { NextResponse } from "next/server";
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { shouldExpireDemand, NotificationType } from "@agrimarket/shared";
import { DEMAND_SELECT, type DemandRow } from "@/app/api/demands/mapping";
import { seedNotifications } from "@/app/lib/notifications";

// POST /api/cron/demands/expire (Issue 09).
//
// Recurring auto-expire: flips OPEN demands whose deadline has passed to
// EXPIRED, then seeds a 'demand.expired' notification for each buyer. Triggered
// by an InsForge managed cron schedule (`*/5 * * * *`) that POSTs this route
// with an X-Cron-Secret header — not a user route, so there's no session and no
// RLS: the admin client (service-role INSFORGE_API_KEY) bypasses RLS to reach
// every buyer's rows.
//
// Idempotency: the SQL pre-filters status='OPEN' AND deadline < now(); the pure
// shouldExpireDemand predicate re-checks each row before UPDATE. A row that
// raced (buyer extended deadline between SELECT and UPDATE) is skipped, and a
// row a prior tick already moved is no longer OPEN so the next SELECT excludes
// it. Re-running a tick is a no-op — no duplicate notifications.
//
// The notification payload carries the demand id + product name so #17's UI can
// render a row ("ประกาศมะม่วงน้ำดอกไม้ หมดอายุแล้ว") without a second round-trip.
export async function POST(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createInsForgeAdminClient();

  // Coarse filter in SQL — uses the existing demands_status_idx. We pull the
  // joined product (DEMAND_SELECT) so the notification payload has the product
  // name without a follow-up query.
  const { data, error } = await admin.database
    .from("demands")
    .select(DEMAND_SELECT)
    .eq("status", "OPEN")
    .lt("deadline", new Date().toISOString());

  if (error) {
    console.error("[cron/demands/expire] select failed", error);
    return NextResponse.json(
      { error: "Failed to load demands" },
      { status: 500 }
    );
  }

  const now = new Date();
  const rows = (data ?? []) as unknown as DemandRow[];
  const targets = rows.filter((row) => shouldExpireDemand(row, now));

  let expired = 0;
  for (const row of targets) {
    const { error: updErr } = await admin.database
      .from("demands")
      .update({ status: "EXPIRED" })
      .eq("id", row.id);

    if (updErr) {
      // Log + keep going — one bad row shouldn't abort the whole tick. The row
      // stays OPEN and the next tick retries it.
      console.error(
        `[cron/demands/expire] update ${row.id} failed`,
        updErr
      );
      continue;
    }

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
    expired += 1;
  }

  console.info(`[cron/demands/expire] expired ${expired} demands`);
  return NextResponse.json({ expired });
}
