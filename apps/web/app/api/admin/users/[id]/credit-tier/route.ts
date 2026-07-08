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
