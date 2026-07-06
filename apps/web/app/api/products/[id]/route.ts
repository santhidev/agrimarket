import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { requireAdmin } from "@/app/lib/require-admin";
import { updateProductSchema } from "@agrimarket/shared";
import { PRODUCT_SELECT, mapProduct, type ProductRow } from "@/app/api/catalog/mapping";

// PATCH /api/products/:id — admin only. Partial update; only provided fields
// are written (zod strict mode rejects unknown keys).
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
  const json = await request.json().catch(() => null);
  const parsed = updateProductSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid product update", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Map camelCase → snake_case only for provided keys.
  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.category !== undefined) patch.category = parsed.data.category;
  if (parsed.data.unit !== undefined) patch.unit = parsed.data.unit;
  if (parsed.data.requiresColdChain !== undefined)
    patch.requires_cold_chain = parsed.data.requiresColdChain;
  if (parsed.data.isFragile !== undefined) patch.is_fragile = parsed.data.isFragile;
  if (parsed.data.shelfLifeHours !== undefined)
    patch.shelf_life_hours = parsed.data.shelfLifeHours;
  if (parsed.data.isStackable !== undefined) patch.is_stackable = parsed.data.isStackable;

  if (Object.keys(patch).length === 0) {
    // No-op: re-read the row so the caller still gets the current state back.
    const client = await createInsForgeServerClient();
    const { data: existing, error: findErr } = await client.database
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("id", id)
      .single();
    if (findErr) {
      return NextResponse.json({ error: "Failed to load product" }, { status: 500 });
    }
    const row = existing as ProductRow | null;
    if (!row) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ product: mapProduct(row) });
  }

  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("products")
    .update(patch)
    .eq("id", id)
    .select(PRODUCT_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }

  const row = data as ProductRow | null;
  if (!row) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({ product: mapProduct(row) });
}

// DELETE /api/products/:id — admin only. Cascades to product_grades (FK
// on delete cascade); downstream demands/offers reference the product later,
// but those tables do not exist yet so no extra guard is needed in MVP.
export async function DELETE(
  _request: Request,
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
  const client = await createInsForgeServerClient();
  const { error } = await client.database.from("products").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
