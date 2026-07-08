import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { notificationQuerySchema } from "@agrimarket/shared";
import {
  NOTIFICATION_SELECT,
  mapNotification,
  type NotificationRow,
} from "./mapping";

// GET /api/notifications — the current user's inbox (Issue 17).
//
// Gate: 401 (no session) → 200. RLS owner-only filters automatically (the
// session user sees only their own rows via the notifications_select_own
// policy). Keyset pagination on (created_at, id) desc — the existing index
// notifications_user_created_idx covers it.
//
// Query: ?unreadOnly=true&limit=20&cursor=<iso>. unreadCount is computed in
// a second count-only request (head: true, count: "exact") so the bell badge
// and the list share one endpoint.

export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = notificationQuerySchema.safeParse({
    unreadOnly: url.searchParams.get("unreadOnly") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { unreadOnly, limit, cursor } = parsed.data;
  const client = await createInsForgeServerClient();

  // List query.
  let query = client.database
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", current.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1); // +1 to detect nextCursor

  if (unreadOnly) {
    query = query.is("read_at", null);
  }
  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as unknown as NotificationRow[];
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? slice[slice.length - 1]?.created_at ?? null
    : null;

  // Unread count (separate count-only request — always counts ALL unread for
  // the user, regardless of the list's unreadOnly filter).
  const { count, error: countErr } = await client.database
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", current.id)
    .is("read_at", null);

  if (countErr) {
    return NextResponse.json(
      { error: "Failed to count unread" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    notifications: slice.map(mapNotification),
    unreadCount: count ?? 0,
    nextCursor,
  });
}
