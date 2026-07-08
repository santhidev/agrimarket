import { NextResponse } from "next/server";
import { createInsForgeAdminClient } from "@/app/lib/insforge-admin";
import { getCurrentUser } from "@/app/lib/get-profile";

// POST /api/notifications/read-all — mark all of the current user's unread
// notifications as read (Issue 17). Used by the UI's "อ่านทั้งหมด" button.
//
// Gate: 401 → 200. Uses the admin client (same reason as the per-id route:
// the table has no user UPDATE policy). The WHERE clause scopes the UPDATE to
// this user's unread rows.

export async function POST() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createInsForgeAdminClient();
  const { error } = await admin.database
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", current.id)
    .is("read_at", null);

  if (error) {
    return NextResponse.json(
      { error: "Failed to mark all read" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
