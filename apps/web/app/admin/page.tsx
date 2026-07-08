import { redirect } from "next/navigation";
import { Users, FileText, TrendingUp, Repeat, CheckCircle } from "lucide-react";
import { getCurrentUser } from "@/app/lib/get-profile";
import { loadAdminDashboard } from "@/app/api/admin/dashboard/load-dashboard";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { Card } from "@/app/components/ui/Card";
import { UsersTable } from "./UsersTable";

// Admin dashboard (Issue 18). Non-admins are bounced to /dashboard. The metric
// snapshot is loaded server-side via the shared loader (no HTTP round-trip);
// the users table is a client island that fetches /api/admin/users.
export default async function AdminPage() {
  const current = await getCurrentUser();
  if (!current || !current.isAdmin) {
    redirect("/dashboard");
  }

  const snap = await loadAdminDashboard();
  const metrics = [
    { icon: Users, label: "ผู้ใช้ทั้งหมด", value: String(snap.totalUsers), sub: "คน" },
    { icon: FileText, label: "ประกาศรับซื้อ", value: String(snap.totalDemands), sub: "รายการ" },
    {
      icon: TrendingUp,
      label: "อัตราจับคู่สำเร็จ",
      value: pct(snap.fulfillmentRate),
      sub: "ของทุกประกาศ",
    },
    {
      icon: CheckCircle,
      label: "อัตราปิดดีล",
      value: pct(snap.transactionSuccess),
      sub: "ของที่จบแล้ว",
    },
    { icon: Repeat, label: "ผู้ซื้อซื้อซ้ำ", value: pct(snap.repeatRate), sub: "ของผู้ซื้อทั้งหมด" },
  ];

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <TopNav isLoggedIn userName={current.phone} />

      <header className="bg-green-700">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          <h1 className="text-white text-2xl font-bold">แดชบอร์ดผู้ดูแลระบบ</h1>
          <p className="text-white/80 text-sm mt-1">
            ภาพรวมสุขภาพแพลตฟอร์ม + จัดการผู้ใช้
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 md:px-8 py-8 space-y-8 flex-1">
        {/* Metrics */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {metrics.map(({ icon: Icon, label, value, sub }) => (
              <Card key={label} className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                    <Icon size={16} className="text-green-700" aria-hidden="true" />
                  </span>
                  <p className="text-xs font-medium text-muted leading-tight">{label}</p>
                </div>
                <p className="text-2xl font-bold text-ink tnum">{value}</p>
                <p className="text-xs text-muted mt-1">{sub}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Users management */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-ink">ผู้ใช้</h2>
          </div>
          <UsersTable />
        </section>
      </main>

      <Footer />
    </div>
  );
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
