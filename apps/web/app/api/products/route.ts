import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { requireAdmin } from "@/app/lib/require-admin";
import { createProductSchema } from "@agrimarket/shared";
import {
  PRODUCT_SELECT,
  mapProduct,
  type ProductRow,
} from "@/app/api/catalog/mapping";

// GET /api/products — public catalog list.
//
// Query params: ?category=ผลไม้ (optional filter). Sorted by created_at desc
// (newest first) so a freshly approved suggestion (#05) surfaces at the top.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category")?.trim() || null;

  const client = await createInsForgeServerClient();
  let query = client.database
    .from("products")
    .select(PRODUCT_SELECT)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }

  const rows = (data ?? []) as ProductRow[];
  return NextResponse.json({ products: rows.map(mapProduct) });
}

// POST /api/products — admin only.
export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: gate.status }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createProductSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid product", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, category, unit, requiresColdChain, isFragile, shelfLifeHours, isStackable } =
    parsed.data;

  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("products")
    .insert([
      {
        name,
        category,
        unit,
        requires_cold_chain: requiresColdChain,
        is_fragile: isFragile,
        shelf_life_hours: shelfLifeHours,
        is_stackable: isStackable,
      },
    ])
    .select(PRODUCT_SELECT)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }

  const row = (data?.[0] as ProductRow | undefined) ?? null;
  if (!row) {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }

  return NextResponse.json({ product: mapProduct(row) }, { status: 201 });
}
