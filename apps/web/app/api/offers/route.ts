import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import {
  createOfferSchema,
  acceptsOffers,
  KycStatus,
} from "@agrimarket/shared";
import {
  OFFER_SELECT,
  mapOffer,
  type OfferRow,
} from "@/app/api/offers/mapping";

// GET /api/offers — the current seller's own offers (Issue 10).
//
// A seller sees only their own offers (RLS seller_id = auth.uid()). Optional
// ?demandId= narrows to one demand. Anonymous → 401.
export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const demandId = url.searchParams.get("demandId") ?? undefined;

  const client = await createInsForgeServerClient();
  let query = client.database
    .from("offers")
    .select(OFFER_SELECT)
    .eq("seller_id", current.id)
    .order("created_at", { ascending: false });

  if (demandId) {
    query = query.eq("demand_id", demandId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load offers" },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as unknown as OfferRow[];
  return NextResponse.json({ offers: rows.map(mapOffer) });
}

// POST /api/offers — a seller submits an offer on a demand (Issue 10).
//
// Gate chain: 401 (no session) → 403 (KYC not Approved) → 400 (bad body) →
// 409 (demand not OPEN) → 409 (duplicate: seller already has an offer on this
// demand) → 201.
//
// seller_id is pinned to the session user (never trusted from the body). The
// demand-side gate (acceptsOffers) and the unique check run before INSERT so a
// seller can't submit on a closed demand or double-submit on the same one.
// Photos are bulk-inserted right after the offer row; the whole insert runs as
// the seller (RLS seller_id = auth.uid()).
export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (current.kycStatus !== KycStatus.Approved) {
    return NextResponse.json(
      { error: "ต้องยืนยันตัวตนก่อนยื่นข้อเสนอ" },
      { status: 403 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createOfferSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid offer", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const {
    demandId,
    productGradeId,
    pricePerUnit,
    quantity,
    photos,
    pickupLat,
    pickupLng,
    readyDate,
  } = parsed.data;

  const client = await createInsForgeServerClient();

  // Load the demand to check it's OPEN. A non-OPEN demand (MATCHED/COMPLETED/
  // EXPIRED/CANCELLED) is closed for new offers — acceptsOffers is the
  // demand-side gate. A hidden demand (non-owner non-admin on a non-OPEN row)
  // reads as null under RLS → 404, so existence isn't leaked.
  const { data: demand, error: demandErr } = await client.database
    .from("demands")
    .select("id, status")
    .eq("id", demandId)
    .single();

  const demandRow = (demand as unknown as { id: string; status: string } | null) ?? null;
  if (!demandRow) {
    return NextResponse.json(
      { error: "Demand not found" },
      { status: 404 }
    );
  }
  if (demandErr) {
    return NextResponse.json(
      { error: "Failed to load demand" },
      { status: 500 }
    );
  }

  if (!acceptsOffers(demandRow.status as never)) {
    return NextResponse.json(
      { error: `Demand is ${demandRow.status}, can't accept new offers` },
      { status: 409 }
    );
  }

  // Unique check: 1 seller = 1 offer per demand. The unique index
  // (offers_demand_seller_uniq) is the DB backstop; this pre-check gives a
  // clean 409 with a helpful message before the insert fails.
  const { data: existing } = await client.database
    .from("offers")
    .select("id")
    .eq("demand_id", demandId)
    .eq("seller_id", current.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "คุณมีข้อเสนอบนประกาศนี้แล้ว แก้ไขข้อเสนอที่มีอยู่แทน" },
      { status: 409 }
    );
  }

  // Insert the offer (status=ACTIVE by default). seller_id pinned to the
  // session user — the INSERT RLS policy (offers_insert_seller_own) rejects any
  // mismatch.
  const { data, error } = await client.database
    .from("offers")
    .insert([
      {
        demand_id: demandId,
        seller_id: current.id,
        product_grade_id: productGradeId ?? null,
        price_per_unit: pricePerUnit,
        quantity,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        ready_date: readyDate,
      },
    ])
    .select(OFFER_SELECT)
    .limit(1);

  if (error) {
    return NextResponse.json(
      { error: "Failed to create offer" },
      { status: 500 }
    );
  }

  const row = (data?.[0] as unknown as OfferRow | undefined) ?? null;
  if (!row) {
    return NextResponse.json(
      { error: "Failed to create offer" },
      { status: 500 }
    );
  }

  // Bulk-insert photos if any. The route links them to the offer id; the
  // INSERT RLS policy (offer_photos_insert_via_offer) checks the offer's
  // seller_id matches auth.uid().
  if (photos.length > 0) {
    const { error: photoErr } = await client.database
      .from("offer_photos")
      .insert(
        photos.map((p, i) => ({
          offer_id: row.id,
          url: p.url,
          key: p.key,
          sort_order: i,
        }))
      );

    if (photoErr) {
      // The offer was created; a photo failure is recoverable (the offer
      // exists, photos can be added via PATCH). Log and return the offer.
      console.error(
        `[offers/POST] photo insert for ${row.id} failed`,
        photoErr
      );
    }

    // Re-read to include the photos in the response.
    const { data: refreshed } = await client.database
      .from("offers")
      .select(OFFER_SELECT)
      .eq("id", row.id)
      .single();
    const refreshedRow = (refreshed as unknown as OfferRow | null) ?? null;
    if (refreshedRow) {
      return NextResponse.json(
        { offer: mapOffer(refreshedRow) },
        { status: 201 }
      );
    }
  }

  return NextResponse.json({ offer: mapOffer(row) }, { status: 201 });
}
