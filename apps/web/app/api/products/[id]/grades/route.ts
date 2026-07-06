import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { requireAdmin } from "@/app/lib/require-admin";
import { createGradeSchema, withDefaultGrade } from "@agrimarket/shared";
import { GRADE_SELECT, mapGrade, type ProductGradeRow } from "@/app/api/catalog/mapping";

// GET /api/products/:id/grades — public.
//
// A product without explicit grades still returns a single synthetic
// "มาตรฐาน" grade (per CONTEXT.md). The default is applied in the API layer;
// the DB never stores a "มาตรฐาน" row.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("product_grades")
    .select(GRADE_SELECT)
    .eq("product_id", id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load grades" }, { status: 500 });
  }

  const rows = (data ?? []) as ProductGradeRow[];
  const grades = withDefaultGrade(rows.map(mapGrade));
  return NextResponse.json({ grades });
}

// POST /api/products/:id/grades — admin only. The :id in the path is the
// parent product; the body carries the grade fields.
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
  const parsed = createGradeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid grade", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, description, sortOrder } = parsed.data;
  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("product_grades")
    .insert([
      {
        product_id: id,
        name,
        description: description ?? null,
        sort_order: sortOrder,
      },
    ])
    .select(GRADE_SELECT)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: "Failed to create grade" }, { status: 500 });
  }

  const row = (data?.[0] as ProductGradeRow | undefined) ?? null;
  if (!row) {
    return NextResponse.json({ error: "Failed to create grade" }, { status: 500 });
  }

  return NextResponse.json({ grade: mapGrade(row) }, { status: 201 });
}
