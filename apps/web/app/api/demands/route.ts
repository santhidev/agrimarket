import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import {
  createDemandSchema,
  demandQuerySchema,
  initialPendingQuantity,
} from "@agrimarket/shared";
import {
  DEMAND_SELECT,
  mapDemand,
  type DemandRow,
} from "@/app/api/demands/mapping";

// GET /api/demands — public browse (Issue 07).
//
// The marketplace list: OPEN demands newest first. Anonymous callers can read
// (sellers must see what buyers want before signing up — Demand-driven GTM,
// CONTEXT.md). Optional ?productId= / ?status= filters narrow the list; an
// unauthenticated caller can only ever see OPEN rows because the
// demands_select_open_or_owner_or_admin RLS policy hides everything else.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = demandQuerySchema.safeParse({
    productId: url.searchParams.get("productId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid demand query", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const client = await createInsForgeServerClient();
  let query = client.database
    .from("demands")
    .select(DEMAND_SELECT)
    .order("created_at", { ascending: false });

  if (parsed.data.productId) {
    query = query.eq("product_id", parsed.data.productId);
  }
  if (parsed.data.status) {
    query = query.eq("status", parsed.data.status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load demands" },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as unknown as DemandRow[];
  return NextResponse.json({ demands: rows.map(mapDemand) });
}

// POST /api/demands — create a demand (Issue 07).
//
// Authenticated buyers only; buyer_id is pinned to the session user and the
// INSERT RLS policy (demands_insert_buyer_own) rejects any mismatch.
// pending_quantity is set to `quantity` via initialPendingQuantity so the
// "pending_quantity initializes to quantity" invariant lives in one place
// (the shared package, unit-tested) rather than copy-pasted at the call site.
export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createDemandSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid demand", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { productId, quantity, deadline, buyerLat, buyerLng } = parsed.data;
  const client = await createInsForgeServerClient();

  const { data, error } = await client.database
    .from("demands")
    .insert([
      {
        product_id: productId,
        buyer_id: current.id,
        quantity,
        pending_quantity: initialPendingQuantity(quantity),
        deadline,
        buyer_lat: buyerLat,
        buyer_lng: buyerLng,
      },
    ])
    .select(DEMAND_SELECT)
    .limit(1);

  if (error) {
    return NextResponse.json(
      { error: "Failed to create demand" },
      { status: 500 }
    );
  }

  const row = (data?.[0] as unknown as DemandRow | undefined) ?? null;
  if (!row) {
    return NextResponse.json(
      { error: "Failed to create demand" },
      { status: 500 }
    );
  }

  return NextResponse.json({ demand: mapDemand(row) }, { status: 201 });
}
