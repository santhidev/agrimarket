// DB row ↔ API shape mappers for the notifications routes (Issue 17).
// Mirrors the demand/offer mapping pattern: snake_case DB → camelCase API.

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

// Columns selected from public.notifications. title/body may be null on
// legacy rows (inserted before Issue 17 added the columns); the client falls
// back to "การแจ้งเตือน" / "" when null.
export const NOTIFICATION_SELECT =
  "id, user_id, type, title, body, payload, read_at, created_at";

export function mapNotification(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title ?? "การแจ้งเตือน",
    body: row.body ?? "",
    payload: row.payload ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
