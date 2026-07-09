import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { seedNotifications } from "@/app/lib/notifications";
import {
  createDemandSchema,
  demandQuerySchema,
  initialPendingQuantity,
  NotificationType,
  demandCreatedRecipients,
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

  // Issue 17: fan-out — notify everyone following this product. buyer_id +
  // product name are already on `row` (DEMAND_SELECT joins the product). The
  // follow query + seed are best-effort: a failure is logged, not thrown.
  //
  // The follows read MUST use the admin client (not the SSR client), because
  // the follows_select_own_or_admin RLS policy only returns rows where
  // user_id = auth.uid() — i.e. the buyer's own follows. The buyer is not the
  // owner of any seller's follow, so the SSR client would return an empty set
  // and the fan-out would silently no-op. The admin client bypasses RLS so the
  // other users' follows are enumerable. This matches the migration's stated
  // intent ("the fan-out for #17's notifications runs server-side via the
  // service-role admin client (bypasses RLS)").
  try {
    const admin = createInsForgeAdminClient();
    const { data: followRows } = await admin.database
      .from("follows")
      .select("user_id, product_id")
      .eq("product_id", row.product_id);

    const follows = ((followRows ?? []) as unknown as {
      user_id: string;
      product_id: string;
    }[]).map((f) => ({
      userId: f.user_id,
      productId: f.product_id,
    }));

    const recipients = demandCreatedRecipients(
      { productId: row.product_id, buyerId: row.buyer_id },
      follows
    );

    if (recipients.length > 0) {
      await seedNotifications(
        admin,
        recipients.map((userId) => ({
          userId,
          type: NotificationType.DemandCreated,
          payload: {
            productName: row.product.name,
            quantity: row.quantity,
            unit: row.product.unit,
          },
        }))
      );
    }
  } catch (e) {
    console.error("[demands/POST] notification fan-out failed", e);
  }

  return NextResponse.json({ demand: mapDemand(row) }, { status: 201 });
}
