import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { requireAdmin } from "@/app/lib/require-admin";

// GET /api/admin/users — list profiles (admin only).
//
// Query params: ?page=1&pageSize=50 — simple offset pagination. Enough for
// the MVP admin dashboard (#18); a search/filter layer arrives there.
export async function GET(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: gate.status }
    );
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? "50") || 50)
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("profiles")
    .select(
      "id, phone, tier, kyc_status, buyer_score, seller_score, is_admin, is_rider, is_hub_staff, hub_id, created_at"
    )
    .order("created_at", { ascending: false })
    .range(from, to);

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
