import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle, FileText, Heart, LogOut, Package, ShieldCheck, Star } from "lucide-react";
import { getCurrentUser } from "@/app/lib/get-profile";
import { signOutAction } from "@/app/login/actions";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { Card } from "@/app/components/ui/Card";
import { Avatar } from "@/app/components/ui/Avatar";

// Protected overview page. Reads the signed-in user's profile row from
// public.profiles (via getCurrentUser) and keeps the per-page redirect("/login")
// guard. Stats are placeholders until demand/offer features ship — labelled
// clearly so they read as empty, not as real zeros.
export default async function DashboardPage() {
  const current = await getCurrentUser();
  if (!current) {
    redirect("/login");
  }

  const displayName = current.phone;
  const tierLabel = TIER_LABELS[current.tier] ?? current.tier;
  const kycLabel = KYC_LABELS[current.kycStatus] ?? current.kycStatus;

  const stats = [
    { icon: FileText, label: "ประกาศรับซื้อ", value: 0 },
    { icon: Package, label: "ข้อเสนอของฉัน", value: 0 },
    { icon: Heart, label: "สินค้าติดตาม", value: 0 },
  ];

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <TopNav isLoggedIn userName={displayName} />

      {/* Profile header */}
      <header className="bg-green-700">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 flex items-center gap-5">
          <Avatar name={displayName} size="lg" />
          <div className="min-w-0">
            <h1 className="text-white text-2xl font-bold truncate">{displayName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-chip bg-white/15 text-white text-xs font-medium">
                <CheckCircle size={12} aria-hidden="true" /> สมาชิก AgriMarket
              </span>
              {current.isAdmin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-chip bg-accent text-white text-xs font-semibold">
                  <ShieldCheck size={12} aria-hidden="true" /> ผู้ดูแลระบบ
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-chip bg-white/15 text-white text-xs font-medium">
                <Star size={12} aria-hidden="true" /> {tierLabel}
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
                    <Icon size={18} className="text-green-700" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-medium text-muted">{label}</p>
                </div>
                <p className="text-2xl font-bold text-ink tnum">{value}</p>
                <p className="text-xs text-muted mt-1">ยังไม่มีข้อมูล — เริ่มสร้างได้เร็วๆ นี้</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Account */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-ink">บัญชีของฉัน</h2>
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:text-green-600"
            >
              ดูโปรไฟล์เต็ม
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <Card className="divide-y divide-line">
            <Row label="รหัสผู้ใช้" value={current.id} mono />
            <Row label="เบอร์โทร" value={current.phone} />
            <Row label="ระดับสมาชิก" value={tierLabel} />
            <Row label="สถานะ KYC" value={kycLabel} />
            <Row label="สถานะผู้ดูแล" value={current.isAdmin ? "ใช่" : "ไม่ใช่"} />
          </Card>
        </section>

        {/* Sign out */}
        <section>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-error border border-error/30 rounded-xl hover:bg-surface transition-colors active:scale-[0.98]"
            >
              <LogOut size={16} aria-hidden="true" /> ออกจากระบบ
            </button>
          </form>
        </section>
      </div>

      <Footer />
    </div>
  );
}

const TIER_LABELS: Record<string, string> = {
  None: "สมาชิกใหม่",
  Bronze: "ระดับบรอนซ์",
  Silver: "ระดับเงิน",
  Gold: "ระดับทอง",
};

const KYC_LABELS: Record<string, string> = {
  None: "ยังไม่ยืนยัน",
  Pending: "รอตรวจสอบ",
  Approved: "ยืนยันแล้ว",
  Rejected: "ไม่ผ่าน",
};

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
