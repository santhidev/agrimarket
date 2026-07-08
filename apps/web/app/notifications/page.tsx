import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/get-profile";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { NotificationsList } from "@/app/components/notifications/NotificationsList";
import {
  NOTIFICATION_SELECT,
  mapNotification,
  type NotificationRow,
} from "@/app/api/notifications/mapping";

export default async function NotificationsPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const client = await createInsForgeServerClient();
  const { data } = await client.database
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", current.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as unknown as NotificationRow[];

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <TopNav isLoggedIn userName={current.phone} userId={current.id} />
      <main className="max-w-2xl mx-auto w-full px-4 md:px-8 py-8 flex-1">
        <h1 className="text-2xl font-bold text-ink mb-6">การแจ้งเตือน</h1>
        <NotificationsList initial={rows.map(mapNotification)} />
      </main>
      <Footer />
    </div>
  );
}
