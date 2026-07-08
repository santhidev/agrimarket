import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";

// GET /api/follows — the current user's followed products (Issue 16).
//
// Returns the join of follows → products so the client gets the product info
// (name, category, unit) alongside the follow metadata (followedAt) in one
// round-trip. RLS (follows_select_own_or_admin) ensures a user sees only their
// own follows; anonymous → 401. Newest follows first so the user sees their
// latest subscriptions on top.
//
// The product join runs through the single follows → products FK, and products
// are public-read (products_select_public), so the nested select returns the
// joined product without a profiles-style RLS wall.
export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("follows")
    .select("product_id, created_at, product:products(id, name, category, unit)")
    .eq("user_id", current.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load followed products" },
      { status: 500 }
    );
  }

  type FollowJoinRow = {
    product_id: string;
    created_at: string;
    product: {
      id: string;
      name: string;
      category: string;
      unit: string;
    } | null;
  };
  const rows = (data ?? []) as unknown as FollowJoinRow[];

  // product can be null only if the product was deleted between the follow and
  // this read (on delete cascade on the FK would take the follow too, so in
  // practice it never is). Filter defensively and keep only live products.
  const products = rows
    .filter((r) => r.product !== null)
    .map((r) => ({
      productId: r.product!.id,
      name: r.product!.name,
      category: r.product!.category,
      unit: r.product!.unit,
      followedAt: r.created_at,
    }));

  return NextResponse.json({ products });
}
