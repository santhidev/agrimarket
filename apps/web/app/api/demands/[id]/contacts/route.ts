import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { DemandStatus } from "@agrimarket/shared";

// GET /api/demands/:id/contacts — buyer reads matched sellers' phones (Issue 15).
//
// After the deal locks (POST /api/demands/:id/match → MATCHED, self-pickup), the
// system hands the buyer the matched sellers' phone numbers so they can arrange
// pickup + payment directly (CONTEXT.md "MATCHED = ระบบให้เบอร์ติดต่อ → buyer
// กับ seller คุยกันเอง"). This endpoint is the buyer-only gate to that contact
// info.
//
// Gate chain: 401 (no session) → 404 (demand missing/hidden under RLS) → 403
// (not the buyer) → 409 (not MATCHED — contact info only exists once the deal
// is locked) → 200. Same .single() null-data-then-error ordering + buyer owner
// gate as the match / select routes.
//
// The seller's phone is joined via the offers → profiles FK
// (seller:profiles!offers_seller_id_fkey(phone)) — the same join the buyer's
// offers view uses (#11). Reading the phone through the offers relationship
// stays inside the buyer's offers RLS (offers_select_buyer_or_seller_or_admin),
// so no profiles RLS violation and no admin/service-role client is needed.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  // Load the demand to (a) confirm the caller can see it (404 if hidden under
  // RLS) and (b) gate on buyer-ownership + MATCHED status. A minimal select is
  // enough — we don't need the full demand shape, just the gate fields.
  const { data: demand, error: demandErr } = await client.database
    .from("demands")
    .select("id, buyer_id, status")
    .eq("id", id)
    .single();

  const demandRow =
    (demand as unknown as {
      id: string;
      buyer_id: string;
      status: string;
    } | null) ?? null;
  if (!demandRow) {
    return NextResponse.json({ error: "Demand not found" }, { status: 404 });
  }
  if (demandErr) {
    return NextResponse.json(
      { error: "Failed to load demand" },
      { status: 500 }
    );
  }
  if (demandRow.buyer_id !== current.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (demandRow.status !== DemandStatus.Matched) {
    return NextResponse.json(
      {
        error: `Demand is ${demandRow.status}, contacts are only available after match`,
      },
      { status: 409 }
    );
  }

  // Load MATCHED offers on this demand, joining the seller's phone. The buyer-
  // ownership + MATCHED gates above ran under the SSR client (RLS); the phone
  // read itself uses the admin client because profiles RLS is owner-only
  // (profiles_select_own_or_admin) — the buyer is NOT the seller, so the SSR
  // join would return sellerPhone: null. The admin client bypasses RLS; the
  // WHERE clause scopes it to this demand's MATCHED offers only.
  const { createInsForgeAdminClient } = await import("@/app/lib/insforge-admin");
  const admin = createInsForgeAdminClient();
  const { data: offerData, error: offerErr } = await admin.database
    .from("offers")
    .select(
      "id, seller_id, accepted_quantity, seller:profiles!offers_seller_profile_fkey(phone)"
    )
    .eq("demand_id", id)
    .eq("status", "MATCHED")
    .order("created_at", { ascending: true });

  if (offerErr) {
    return NextResponse.json(
      { error: "Failed to load contacts" },
      { status: 500 }
    );
  }

  type MatchedContact = {
    id: string;
    seller_id: string;
    accepted_quantity: number | null;
    seller: { phone: string } | null;
  };
  const rows = (offerData ?? []) as unknown as MatchedContact[];

  return NextResponse.json({
    contacts: rows.map((r) => ({
      offerId: r.id,
      sellerId: r.seller_id,
      sellerPhone: r.seller?.phone ?? null,
      acceptedQuantity: r.accepted_quantity,
    })),
  });
}
