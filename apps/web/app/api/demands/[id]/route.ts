import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import {
  DEMAND_SELECT,
  mapDemand,
  type DemandRow,
} from "@/app/api/demands/mapping";

// GET /api/demands/:id — single demand with its offers inlined (Issue 07).
//
// OPEN demands are public; non-OPEN demands are owner-or-admin (RLS). Offers
// are not yet a table (#10), so the response carries an empty `offers` array
// placeholder — the shape is stable for when #10 fills it in. A missing id, or
// a non-OPEN demand the caller can't see, both surface as 404 (the .single()
// read runs under the caller's RLS and returns null data on a hidden row) so
// existence is never leaked.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await createInsForgeServerClient();

  // .single() returns BOTH an error (PGRST116) and null data on 0 rows. The
  // select_open_or_owner_or_admin policy hides a non-owner's non-OPEN demand,
  // so a "not allowed to see" row reads as null too — treat both as 404.
  const { data, error } = await client.database
    .from("demands")
    .select(DEMAND_SELECT)
    .eq("id", id)
    .single();

  const row = (data as unknown as DemandRow | null) ?? null;
  if (!row) {
    return NextResponse.json({ error: "Demand not found" }, { status: 404 });
  }
  if (error) {
    return NextResponse.json(
      { error: "Failed to load demand" },
      { status: 500 }
    );
  }

  return NextResponse.json({ demand: mapDemand(row) });
}
