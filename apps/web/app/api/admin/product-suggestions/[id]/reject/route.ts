import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { requireAdmin } from "@/app/lib/require-admin";
import { rejectProductSuggestionSchema } from "@agrimarket/shared";
import {
  SUGGESTION_SELECT,
  mapSuggestion,
  type ProductSuggestionRow,
} from "@/app/api/catalog/mapping";

// POST /api/admin/product-suggestions/:id/reject — admin only.
//
// Sets the suggestion to REJECTED and stores the mandatory rejection reason.
// Double-reject is a 409 (the suggestion is no longer PENDING).
export async function POST(
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
  const parsed = rejectProductSuggestionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid rejection", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const client = await createInsForgeServerClient();

  // Load first to distinguish 404 from 409. .single() returns BOTH an error
  // (PGRST116) and null data when 0 rows match, so a missing id reaches here as
  // an error — treat that as 404, not 500.
  const { data: existing, error: findErr } = await client.database
    .from("product_suggestions")
    .select(SUGGESTION_SELECT)
    .eq("id", id)
    .single();

  const current = existing as ProductSuggestionRow | null;
  if (!current) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }
  if (findErr) {
    return NextResponse.json({ error: "Failed to load suggestion" }, { status: 500 });
  }
  if (current.status !== "PENDING") {
    return NextResponse.json(
      { error: `Suggestion already ${current.status}` },
      { status: 409 }
    );
  }

  const { data: updated, error: updErr } = await client.database
    .from("product_suggestions")
    .update({
      status: "REJECTED",
      rejection_reason: parsed.data.rejectionReason,
      reviewed_by: gate.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SUGGESTION_SELECT)
    .single();

  if (updErr) {
    return NextResponse.json({ error: "Failed to reject suggestion" }, { status: 500 });
  }

  const row = updated as ProductSuggestionRow | null;
  return NextResponse.json({
    suggestion: row ? mapSuggestion(row) : null,
  });
}
