import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { requireAdmin } from "@/app/lib/require-admin";
import {
  SUGGESTION_SELECT,
  mapSuggestion,
  type ProductSuggestionRow,
} from "@/app/api/catalog/mapping";

// GET /api/admin/product-suggestions/pending — admin only.
//
// Returns PENDING suggestions oldest-first (FIFO review queue) so the longest-
// waiting requesters are addressed first.
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: gate.status }
    );
  }

  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("product_suggestions")
    .select(SUGGESTION_SELECT)
    .eq("status", "PENDING")
    .order("submitted_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load pending suggestions" }, { status: 500 });
  }

  const rows = (data ?? []) as ProductSuggestionRow[];
  return NextResponse.json({ suggestions: rows.map(mapSuggestion) });
}
