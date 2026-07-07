import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import {
  canEditOffer,
  canWithdrawOffer,
  updateOfferSchema,
  OfferStatus,
} from "@agrimarket/shared";
import {
  OFFER_SELECT,
  mapOffer,
  type OfferRow,
} from "@/app/api/offers/mapping";

// GET /api/offers/:id — a single offer with its photos (Issue 10).
//
// The buyer of the parent demand, the offer's seller, or an admin can read
// (RLS offers_select_buyer_or_seller_or_admin). A hidden row reads as null →
// 404, so existence is never leaked.
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

  const { data, error } = await client.database
    .from("offers")
    .select(OFFER_SELECT)
    .eq("id", id)
    .single();

  const row = (data as unknown as OfferRow | null) ?? null;
  if (!row) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }
  if (error) {
    return NextResponse.json(
      { error: "Failed to load offer" },
      { status: 500 }
    );
  }

  return NextResponse.json({ offer: mapOffer(row) });
}

// PATCH /api/offers/:id — seller edits their own ACTIVE offer (Issue 10).
//
// Gate chain: 401 → 404 (missing/not visible) → 403 (not seller) → 409 (not
// ACTIVE via canEditOffer) → 400 (bad body / empty) → 200. demandId and
// sellerId are immutable; status flips via DELETE (withdraw) or the buyer-
// select flow (#11). Photos, if present, are replaced wholesale.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  // Load first to distinguish 404 (missing/hidden) from 403 (not seller) from
  // 409 (wrong state). Same .single() null-then-error ordering as demands.
  const { data: existing, error: findErr } = await client.database
    .from("offers")
    .select(OFFER_SELECT)
    .eq("id", id)
    .single();

  const row = (existing as unknown as OfferRow | null) ?? null;
  if (!row) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }
  if (findErr) {
    return NextResponse.json(
      { error: "Failed to load offer" },
      { status: 500 }
    );
  }
  if (row.seller_id !== current.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canEditOffer(row.status as never)) {
    return NextResponse.json(
      { error: `Offer is ${row.status}, can't be edited` },
      { status: 409 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = updateOfferSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid offer update", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Build the update payload from the present fields. photos are handled
  // separately (wholesale replace) — only scalar columns go in the UPDATE.
  const updates: Record<string, unknown> = {};
  if (parsed.data.productGradeId !== undefined)
    updates.product_grade_id = parsed.data.productGradeId;
  if (parsed.data.pricePerUnit !== undefined)
    updates.price_per_unit = parsed.data.pricePerUnit;
  if (parsed.data.quantity !== undefined) updates.quantity = parsed.data.quantity;
  if (parsed.data.pickupLat !== undefined) updates.pickup_lat = parsed.data.pickupLat;
  if (parsed.data.pickupLng !== undefined) updates.pickup_lng = parsed.data.pickupLng;
  if (parsed.data.readyDate !== undefined) updates.ready_date = parsed.data.readyDate;

  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await client.database
      .from("offers")
      .update(updates)
      .eq("id", id);

    if (updErr) {
      return NextResponse.json(
        { error: "Failed to update offer" },
        { status: 500 }
      );
    }
  }

  // Wholesale-replace photos if present in the body.
  if (parsed.data.photos !== undefined) {
    // Delete existing photos, then bulk-insert the new set.
    const { error: delErr } = await client.database
      .from("offer_photos")
      .delete()
      .eq("offer_id", id);

    if (delErr) {
      console.error(`[offers/PATCH] photo delete for ${id} failed`, delErr);
    }

    if (parsed.data.photos.length > 0) {
      const { error: photoErr } = await client.database
        .from("offer_photos")
        .insert(
          parsed.data.photos.map((p, i) => ({
            offer_id: id,
            url: p.url,
            key: p.key,
            sort_order: i,
          }))
        );

      if (photoErr) {
        console.error(
          `[offers/PATCH] photo insert for ${id} failed`,
          photoErr
        );
      }
    }
  }

  // Re-read to return the updated offer with photos.
  const { data: refreshed } = await client.database
    .from("offers")
    .select(OFFER_SELECT)
    .eq("id", id)
    .single();

  const next = (refreshed as unknown as OfferRow | null) ?? null;
  return NextResponse.json({ offer: next ? mapOffer(next) : null });
}

// DELETE /api/offers/:id — seller withdraws (soft → WITHDRAWN) (Issue 10).
//
// Gate chain: 401 → 404 → 403 (not seller) → 409 (not withdrawable via
// canWithdrawOffer) → 200. Soft-delete: status → WITHDRAWN, row stays for
// history + the unique constraint (so the seller can't re-submit on the same
// demand). MATCHED is locked; terminal statuses can't withdraw again.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  const { data: existing, error: findErr } = await client.database
    .from("offers")
    .select(OFFER_SELECT)
    .eq("id", id)
    .single();

  const row = (existing as unknown as OfferRow | null) ?? null;
  if (!row) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }
  if (findErr) {
    return NextResponse.json(
      { error: "Failed to load offer" },
      { status: 500 }
    );
  }
  if (row.seller_id !== current.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canWithdrawOffer(row.status as never)) {
    return NextResponse.json(
      { error: `Offer is ${row.status}, can't be withdrawn` },
      { status: 409 }
    );
  }

  const { data: updated, error: updErr } = await client.database
    .from("offers")
    .update({ status: OfferStatus.Withdrawn })
    .eq("id", id)
    .select(OFFER_SELECT)
    .single();

  if (updErr) {
    return NextResponse.json(
      { error: "Failed to withdraw offer" },
      { status: 500 }
    );
  }

  const next = (updated as unknown as OfferRow | null) ?? null;
  return NextResponse.json({ offer: next ? mapOffer(next) : null });
}
