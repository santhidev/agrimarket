import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { requireAdmin } from "@/app/lib/require-admin";
import { updateGradeSchema } from "@agrimarket/shared";
import { GRADE_SELECT, mapGrade, type ProductGradeRow } from "@/app/api/catalog/mapping";

// PATCH /api/product-grades/:id — admin only.
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
  const parsed = updateGradeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid grade update", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.sortOrder !== undefined) patch.sort_order = parsed.data.sortOrder;

  if (Object.keys(patch).length === 0) {
    const client = await createInsForgeServerClient();
    const { data: existing, error: findErr } = await client.database
      .from("product_grades")
      .select(GRADE_SELECT)
      .eq("id", id)
      .single();
    if (findErr) {
      return NextResponse.json({ error: "Failed to load grade" }, { status: 500 });
    }
    const row = existing as ProductGradeRow | null;
    if (!row) {
      return NextResponse.json({ error: "Grade not found" }, { status: 404 });
    }
    return NextResponse.json({ grade: mapGrade(row) });
  }

  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("product_grades")
    .update(patch)
    .eq("id", id)
    .select(GRADE_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update grade" }, { status: 500 });
  }

  const row = data as ProductGradeRow | null;
  if (!row) {
    return NextResponse.json({ error: "Grade not found" }, { status: 404 });
  }

  return NextResponse.json({ grade: mapGrade(row) });
}

// DELETE /api/product-grades/:id — admin only.
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
  const { error } = await client.database.from("product_grades").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete grade" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
