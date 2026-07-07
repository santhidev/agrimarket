import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import {
  canEditDemand,
  extendDemandSchema,
  isDeadlineExtension,
} from "@agrimarket/shared";
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

// PATCH /api/demands/:id — buyer extends the deadline (Issue 08).
//
// Owner-only (RLS update policy demands_update_owner_or_admin). Issue 08 scope
// is deadline-only: quantity/product/lat-lng are immutable after create. The
// demand must be OPEN (canEditDemand gate), and the new deadline must be
// strictly later than the current one (isDeadlineExtension) — shortening or
// no-op is refused. Reads under the caller's RLS so a non-owner's hidden row
// surfaces as 404 (no existence leak), then a 403 separates "can see but not
// yours" OPEN rows from a missing row.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  // Load first to distinguish 404 (missing/hidden) from 403 (not owner) from
  // 409 (wrong state). .single() null-data-then-error ordering handled: a
  // hidden row reads as null → 404 before the error branch fires.
  const { data: existing, error: findErr } = await client.database
    .from("demands")
    .select(DEMAND_SELECT)
    .eq("id", id)
    .single();

  const row = (existing as unknown as DemandRow | null) ?? null;
  if (!row) {
    return NextResponse.json({ error: "Demand not found" }, { status: 404 });
  }
  if (findErr) {
    return NextResponse.json(
      { error: "Failed to load demand" },
      { status: 500 }
    );
  }
  if (row.buyer_id !== current.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canEditDemand(row.status as never)) {
    return NextResponse.json(
      { error: `Demand is ${row.status}, can't be edited` },
      { status: 409 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = extendDemandSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid demand update", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Strictly-later check owns the ordering rule (schema has no cross-field
  // context). Refuses shortening and equality; malformed already 400'd above.
  if (!isDeadlineExtension(row.deadline, parsed.data.deadline)) {
    return NextResponse.json(
      { error: "New deadline must be later than the current one" },
      { status: 400 }
    );
  }

  const { data: updated, error: updErr } = await client.database
    .from("demands")
    .update({ deadline: parsed.data.deadline })
    .eq("id", id)
    .select(DEMAND_SELECT)
    .single();

  if (updErr) {
    return NextResponse.json(
      { error: "Failed to update demand" },
      { status: 500 }
    );
  }

  const next = (updated as unknown as DemandRow | null) ?? null;
  return NextResponse.json({ demand: next ? mapDemand(next) : null });
}

// DELETE /api/demands/:id — buyer cancels (Issue 08).
//
// Soft-cancel: flips status to CANCELLED via the existing update policy (no
// hard delete — the row stays for history + the cascade audit). Same owner +
// OPEN gates as PATCH. The cascade ("every ACTIVE/PENDING/CONFIRMED offer →
// CANCELLED") is Issue 10's job once the offers table exists; Issue 08 only
// flips the demand. The pure predicate shouldCancelOfferOnDemandCancel is
// already in @agrimarket/shared, so #10 wires it in a single place.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  const { data: existing, error: findErr } = await client.database
    .from("demands")
    .select(DEMAND_SELECT)
    .eq("id", id)
    .single();

  const row = (existing as unknown as DemandRow | null) ?? null;
  if (!row) {
    return NextResponse.json({ error: "Demand not found" }, { status: 404 });
  }
  if (findErr) {
    return NextResponse.json(
      { error: "Failed to load demand" },
      { status: 500 }
    );
  }
  if (row.buyer_id !== current.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canEditDemand(row.status as never)) {
    return NextResponse.json(
      { error: `Demand is ${row.status}, can't be cancelled` },
      { status: 409 }
    );
  }

  const { data: updated, error: updErr } = await client.database
    .from("demands")
    .update({ status: "CANCELLED" })
    .eq("id", id)
    .select(DEMAND_SELECT)
    .single();

  if (updErr) {
    return NextResponse.json(
      { error: "Failed to cancel demand" },
      { status: 500 }
    );
  }

  // Issue 08 cascade NOTE: when the offers table lands (#10), the route will
  // also UPDATE offers SET status='CANCELLED' WHERE demand_id=id AND status IN
  // ('ACTIVE','PENDING_SELLER_CONFIRMATION','CONFIRMED'). The predicate lives
  // in @agrimarket/shared (shouldCancelOfferOnDemandCancel) so #10 reuses it
  // without re-deriving the rule. No offers table yet → nothing to cascade.
  const next = (updated as unknown as DemandRow | null) ?? null;
  return NextResponse.json({ demand: next ? mapDemand(next) : null });
}
