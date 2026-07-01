import { redirect } from "next/navigation";
import { CheckCircle, FileText, Heart, LogOut, Package, ShieldCheck, Star } from "lucide-react";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { signOutAction } from "@/app/login/actions";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { Card } from "@/app/components/ui/Card";
import { Avatar } from "@/app/components/ui/Avatar";

// Protected overview page. Reads the real signed-in user from InsForge and
// keeps the per-page redirect("/login") guard. Stats are placeholders until
// demand/offer features ship — labelled clearly so they read as empty, not as
// real zeros.
export default async function DashboardPage() {
  const client = await createInsForgeServerClient();
  const { data } = await client.auth.getCurrentUser();

  if (!data?.user) {
    redirect("/login");
  }

  const user = data.user;
  const profile = user.metadata ?? {};
  const phone = profile.phone ?? user.email ?? "—";
  const isAdmin = Boolean(profile.is_admin);
  const displayName = typeof phone === "string" ? phone : user.id.slice(0, 8);

  const stats = [
    { icon: FileText, label: "ประกาศรับซื้อ", value: 0 },
    { icon: Package, label: "ข้อเสนอของฉัน", value: 0 },
    { icon: Heart, label: "สินค้าติดตาม", value: 0 },
  ];

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <TopNav isLoggedIn userName={String(displayName)} />

      {/* Profile header */}
      <header
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 flex items-center gap-5">
          <Avatar name={String(displayName)} size="lg" />
          <div className="min-w-0">
            <h1 className="text-white text-2xl font-bold truncate">{displayName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-chip bg-white/15 text-white text-xs font-medium">
                <CheckCircle size={12} /> สมาชิก AgriMarket
              </span>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-chip bg-accent text-ink text-xs font-semibold">
                  <ShieldCheck size={12} /> ผู้ดูแลระบบ
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-chip bg-white/15 text-white text-xs font-medium">
                <Star size={12} /> สมาชิกใหม่
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-8 space-y-8 flex-1">
        {/* Stats */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map(({ icon: Icon, label, value }) => (
              <Card key={label} className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <Icon size={18} className="text-green-600" />
                  </span>
                  <p className="text-sm font-medium text-muted">{label}</p>
                </div>
                <p className="text-2xl font-bold text-ink">{value}</p>
                <p className="text-xs text-muted mt-1">ยังไม่มีข้อมูล — เริ่มสร้างได้เร็วๆ นี้</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Account */}
        <section>
          <h2 className="text-lg font-bold text-ink mb-4">บัญชีของฉัน</h2>
          <Card className="divide-y divide-[var(--color-line)]">
            <Row label="รหัสผู้ใช้" value={user.id} mono />
            <Row label="เบอร์โทร" value={String(phone)} />
            <Row label="สถานะผู้ดูแล" value={isAdmin ? "ใช่" : "ไม่ใช่"} />
          </Card>
        </section>

        {/* Sign out */}
        <section>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-error border border-error/30 rounded-xl hover:bg-[#ffeeee] transition-colors"
            >
              <LogOut size={16} /> ออกจากระบบ
            </button>
          </form>
        </section>
      </div>

      <Footer />
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={`text-sm text-ink text-right break-all ${mono ? "font-mono" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}
