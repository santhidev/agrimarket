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
// tables we (a) use select(col, { count: 'exact', head: true }) to get a bare
// count (matches the health-route idiom), and (b) for repeat rate we pull
// buyer_id from every demand and tally distinct buyers in JS. Query errors
// throw — the route wraps this in try/catch; a silent 0 would mask a broken DB.
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
  const totalDemands = open + matched + completed + expired + cancelled;

  // Repeat rate: pull every demand's buyer_id and count distinct + repeat
  // buyers in JS. (No COUNT(DISTINCT) over the API.)
  const { data: buyerRows, error: buyerErr } = await client.database
    .from("demands")
    .select("buyer_id");
  if (buyerErr) throw buyerErr;
  const counts = new Map<string, number>();
  for (const r of (buyerRows as Array<{ buyer_id: string }>) ?? []) {
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

async function countDemandsByStatus(
  client: Awaited<ReturnType<typeof createInsForgeServerClient>>,
  status: string
): Promise<number> {
  const { count, error } = await client.database
    .from("demands")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  if (error) throw error;
  return count ?? 0;
}

async function countProfiles(
  client: Awaited<ReturnType<typeof createInsForgeServerClient>>
): Promise<number> {
  const { count, error } = await client.database
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
