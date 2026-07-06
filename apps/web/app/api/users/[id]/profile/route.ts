import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";

// GET /api/users/:id/profile
//
// A user may read their own profile; admins may read any profile. Everyone
// else gets 403 (401 if there is no session). The RLS policy on
// public.profiles enforces the same rule at the database layer.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (id !== current.id && !current.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("profiles")
    .select(
      "id, phone, tier, kyc_status, buyer_score, seller_score, is_admin, is_rider, is_hub_staff, hub_id"
    )
    .eq("id", id)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  const row = data?.[0] as
    | {
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
      }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    phone: row.phone,
    tier: row.tier,
    kycStatus: row.kyc_status,
    buyerScore: row.buyer_score,
    sellerScore: row.seller_score,
    isAdmin: row.is_admin,
    isRider: row.is_rider,
    isHubStaff: row.is_hub_staff,
    hubId: row.hub_id,
  });
}
