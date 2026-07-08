import { NextResponse } from "next/server";
import { z } from "zod";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { canEditDemand, computeBestOffers } from "@agrimarket/shared";
import {
  DEMAND_SELECT,
  type DemandRow,
} from "@/app/api/demands/mapping";

// POST /api/demands/:id/best-offer — ranked offer combinations (Issue 13).
//
// The buyer asks the solver for the cheapest way(s) to fulfill their demand
// from the ACTIVE offers. Whole-offer selection (0/1) with overflow trimmed
// from the most-expensive offer in each subset so the combination lands
// exactly on demand.quantity; total distance (Haversine, weighted by quantity)
// breaks ties on equal total cost. Returns up to 5 combinations, full-Q first,
// partial only when total supply can't fulfill. The solver is pure
// (@agrimarket/shared); this route only loads data + maps it.
//
// Gate chain: 401 (no session) → 404 (demand missing/hidden under RLS) → 403
// (not the buyer) → 409 (not OPEN via canEditDemand) → 400 (bad body or too
// many offers to enumerate safely) → 200. Same .single() null-data-then-error
// ordering + buyer owner gate as the demand PATCH/DELETE + counter-offer
// routes. The OPEN-only gate matches the negotiation window — once MATCHED
// the demand is settled.
//
// Cap guard: subset enumeration is 2^n; n > 20 (≈1M+ subsets) risks latency,
// so the route refuses with 400. In the MVP a single-SKU demand rarely has
// 20+ sellers; if it does, the buyer should narrow via counter-offer first.

const MAX_OFFERS_TO_ENUMERATE = 20;

const bodySchema = z
  .object({
    // The solver caps at 5; the client may ask for fewer (1-5). Defaults to 5.
    maxCombinations: z.number().int().min(1).max(5).optional(),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  // Load first to distinguish 404 (missing/hidden) from 403 (not buyer) from
  // 409 (wrong state). .single() null-data-then-error ordering handled: a
  // hidden row reads as null → 404 before the error branch fires.
  const { data: existing, error: findErr } = await client.database
    .from("demands")
    .select(DEMAND_SELECT)
    .eq("id", id)
    .single();

  const row = (existing as unknown as DemandRow | null) ?? null;
  if (!row) {
    return NextResponse.json({ error: "Demand not found" }, { status: 404 });
  }
  if (findErr) {
    return NextResponse.json(
      { error: "Failed to load demand" },
      { status: 500 }
    );
  }
  if (row.buyer_id !== current.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canEditDemand(row.status as never)) {
    return NextResponse.json(
      { error: `Demand is ${row.status}, best-offer is read on OPEN demands only` },
      { status: 409 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // The buyer sees all offers on their demand (RLS). The solver only needs
  // ACTIVE offers — a withdrawn/rejected/expired offer is not competing.
  // price_per_unit comes back as a string from numeric(12,2); coerce here.
  const activeOffers = (row.offers ?? [])
    .filter((o) => o.status === "ACTIVE")
    .map((o) => ({
      id: o.id,
      pricePerUnit:
        typeof o.price_per_unit === "string"
          ? Number(o.price_per_unit)
          : o.price_per_unit,
      quantity: o.quantity,
      pickupLat: o.pickup_lat,
      pickupLng: o.pickup_lng,
    }));

  if (activeOffers.length > MAX_OFFERS_TO_ENUMERATE) {
    return NextResponse.json(
      {
        error: `Too many offers (${activeOffers.length}) to enumerate — narrow by sending a counter-offer first`,
      },
      { status: 400 }
    );
  }

  const maxCombinations = parsed.data.maxCombinations ?? 5;
  const result = computeBestOffers({
    targetQuantity: row.quantity,
    buyerLat: row.buyer_lat,
    buyerLng: row.buyer_lng,
    offers: activeOffers,
  });

  // The solver always caps at 5; respect a lower client ceiling by slicing.
  return NextResponse.json({
    combinations: result.combinations.slice(0, maxCombinations),
    canFulfill: result.canFulfill,
  });
}
