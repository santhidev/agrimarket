import { describeNotification, type NotificationType } from "@agrimarket/shared";
import type { createInsForgeAdminClient } from "./insforge-admin";

// Server-only: never import into a Client Component.

type AdminClient = ReturnType<typeof createInsForgeAdminClient>;

export type NotificationInput = {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
};

// Bulk-insert notifications via the service-role admin client (bypasses RLS —
// the notifications table has no user INSERT policy; every write is a system-
// actor write, same as the Issue 09/15 cron routes). title/body are derived
// via describeNotification(). Empty input is a no-op.
//
// A failed insert is LOGGED, never thrown — mirrors the cron routes' rule:
// the state change (offer created, demand posted, etc.) already succeeded, so
// a missing notification is recoverable, not fatal. Returns void; callers do
// not branch on the outcome.
export async function seedNotifications(
  admin: AdminClient,
  inputs: NotificationInput[]
): Promise<void> {
  if (inputs.length === 0) return;

  const rows = inputs.map(({ userId, type, payload }) => {
    const { title, body } = describeNotification(type, payload);
    return { user_id: userId, type, title, body, payload };
  });

  const { error } = await admin.database.from("notifications").insert(rows);
  if (error) {
    console.error("[notifications] seed failed", {
      firstType: inputs[0]?.type,
      count: inputs.length,
      error,
    });
  }
}
