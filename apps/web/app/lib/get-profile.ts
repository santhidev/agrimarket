import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import type { Profile } from "@agrimarket/shared";

// Profile shape as returned by the API/UI: camelCase (DB stores snake_case).
type ProfileRow = {
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
};

export type CurrentUser = Profile & {
  isRider: boolean;
  isHubStaff: boolean;
  hubId: string | null;
};

// Resolve the current session user + their public.profiles row.
// Returns null when there is no session or no profile row yet.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const client = await createInsForgeServerClient();
  const { data: authData } = await client.auth.getCurrentUser();
  if (!authData?.user) return null;

  const { data } = await client.database
    .from("profiles")
    .select(
      "id, phone, tier, kyc_status, buyer_score, seller_score, is_admin, is_rider, is_hub_staff, hub_id"
    )
    .eq("id", authData.user.id)
    .limit(1);

  const row = (data?.[0] as ProfileRow | undefined) ?? null;
  if (!row) return null;

  return {
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
  };
}
