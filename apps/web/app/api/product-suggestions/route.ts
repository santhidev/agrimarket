import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { createProductSuggestionSchema } from "@agrimarket/shared";
import {
  SUGGESTION_SELECT,
  mapSuggestion,
  type ProductSuggestionRow,
} from "@/app/api/catalog/mapping";

// GET /api/product-suggestions — the current user's own suggestions, newest
// first. Anonymous → 401. The RLS policy (requester_id = auth.uid()) enforces
// ownership at the DB layer too.
export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("product_suggestions")
    .select(SUGGESTION_SELECT)
    .eq("requester_id", current.id)
    .order("submitted_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load suggestions" }, { status: 500 });
  }

  const rows = (data ?? []) as ProductSuggestionRow[];
  return NextResponse.json({ suggestions: rows.map(mapSuggestion) });
}

// POST /api/product-suggestions — submit a new product suggestion.
// Authenticated users only; requester_id is pinned to the current user (the
// INSERT RLS policy rejects any mismatch).
export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createProductSuggestionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid suggestion", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, category, unit } = parsed.data;
  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("product_suggestions")
    .insert([
      {
        requester_id: current.id,
        name,
        category,
        unit,
      },
    ])
    .select(SUGGESTION_SELECT)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: "Failed to submit suggestion" }, { status: 500 });
  }

  const row = (data?.[0] as ProductSuggestionRow | undefined) ?? null;
  if (!row) {
    return NextResponse.json({ error: "Failed to submit suggestion" }, { status: 500 });
  }

  return NextResponse.json({ suggestion: mapSuggestion(row) }, { status: 201 });
}
