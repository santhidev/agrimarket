import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { getCurrentUser } from "@/app/lib/get-profile";

// POST /api/notifications/:id/read — mark one notification as read (Issue 17).
//
// Gate: 401 (no session) → 404 (not owner / not found — load first via
// .maybeSingle(); a null row means either missing or someone else's, both
// surface as 404 to avoid existence leaks) → 200. Idempotent: marking an
// already-read row is 200.
//
// The UPDATE runs via the admin client because the table has no user UPDATE
// policy (Issue 09 left only a SELECT policy). Belt + suspenders: the route
// first confirms ownership via a SELECT under the SSR client (RLS-bounded),
// then UPDATEs via the admin client with both id + user_id in the WHERE
// clause.

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  // Confirm ownership under the user's RLS — a null row is "not found" or
  // "not yours", both → 404 (no existence leak).
  const { data: existing, error: findErr } = await client.database
    .from("notifications")
    .select("id")
    .eq("id", id)
    .eq("user_id", current.id)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json(
      { error: "Failed to load notification" },
      { status: 500 }
    );
  }
  if (!existing) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 }
    );
  }

  // Admin client bypasses RLS for the UPDATE; the WHERE clause scopes it to
  // this user + this id.
  const admin = createInsForgeAdminClient();
  const { error: updErr } = await admin.database
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", current.id);

  if (updErr) {
    return NextResponse.json(
      { error: "Failed to mark read" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
