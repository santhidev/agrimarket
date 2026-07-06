import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { requireAdmin } from "@/app/lib/require-admin";
import { buildProductFromSuggestion } from "@agrimarket/shared";
import {
  SUGGESTION_SELECT,
  PRODUCT_SELECT,
  mapSuggestion,
  mapProduct,
  type ProductSuggestionRow,
  type ProductRow,
} from "@/app/api/catalog/mapping";

// POST /api/admin/product-suggestions/:id/approve — admin only.
//
// Creates a `products` row from the suggestion (applying catalog defaults) and
// marks the suggestion APPROVED with reviewer + timestamp. The suggestion must
// still be PENDING — reviewing it twice is a 409. Returns the new product.
export async function POST(
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

  // Load the current state to distinguish 404 (missing) from 409 (already
  // reviewed). Both admin-visible.
  const { data: existing, error: findErr } = await client.database
    .from("product_suggestions")
    .select(SUGGESTION_SELECT)
    .eq("id", id)
    .single();

  if (findErr) {
    return NextResponse.json({ error: "Failed to load suggestion" }, { status: 500 });
  }

  const current = existing as ProductSuggestionRow | null;
  if (!current) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }
  if (current.status !== "PENDING") {
    return NextResponse.json(
      { error: `Suggestion already ${current.status}` },
      { status: 409 }
    );
  }

  // Create the catalog product from the suggestion, then flip the suggestion to
  // APPROVED. The product insert runs as the admin (RLS is_current_admin).
  const productPayload = buildProductFromSuggestion(current);
  const { data: productData, error: productErr } = await client.database
    .from("products")
    .insert([productPayload])
    .select(PRODUCT_SELECT)
    .single();

  if (productErr) {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }

  const { data: updated, error: updErr } = await client.database
    .from("product_suggestions")
    .update({
      status: "APPROVED",
      reviewed_by: gate.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SUGGESTION_SELECT)
    .single();

  if (updErr) {
    return NextResponse.json({ error: "Failed to approve suggestion" }, { status: 500 });
  }

  const suggestionRow = updated as ProductSuggestionRow | null;
  const productRow = productData as ProductRow | null;

  return NextResponse.json({
    suggestion: suggestionRow ? mapSuggestion(suggestionRow) : null,
    product: productRow ? mapProduct(productRow) : null,
  });
}
