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
