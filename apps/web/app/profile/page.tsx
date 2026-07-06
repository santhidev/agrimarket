import { redirect } from "next/navigation";
import {
  BadgeCheck,
  CreditCard,
  LogOut,
  Phone,
  ShieldCheck,
  Star,
  TrendingUp,
  User,
} from "lucide-react";
import { getCurrentUser } from "@/app/lib/get-profile";
import { signOutAction } from "@/app/login/actions";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { Card } from "@/app/components/ui/Card";
import { Avatar } from "@/app/components/ui/Avatar";

// Profile page — reads the current user's profile row from public.profiles.
// Renders phone, KYC status, credit tier, scores, and admin/role badges.
export default async function ProfilePage() {
  const current = await getCurrentUser();
  if (!current) {
    redirect("/login");
  }

  const displayName = current.phone;
  const tierLabel = TIER_LABELS[current.tier] ?? current.tier;
  const kyc = KYC_VIEW[current.kycStatus] ?? KYC_VIEW.None;

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <TopNav isLoggedIn userName={displayName} />

      {/* Profile header */}
      <header
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)" }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 flex items-center gap-5">
          <Avatar name={displayName} size="lg" />
          <div className="min-w-0">
            <h1 className="text-white text-2xl font-bold truncate">{displayName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-chip text-xs font-semibold"
                style={{ color: kyc.fg, backgroundColor: kyc.bg }}
              >
                <BadgeCheck size={12} /> {kyc.label}
              </span>
              {current.isAdmin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-chip bg-accent text-ink text-xs font-semibold">
                  <ShieldCheck size={12} /> ผู้ดูแลระบบ
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-chip bg-white/15 text-white text-xs font-medium">
                <Star size={12} /> {tierLabel}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-8 space-y-8 flex-1">
        {/* Personal info */}
        <section>
          <h2 className="text-lg font-bold text-ink mb-4">ข้อมูลส่วนตัว</h2>
          <Card className="divide-y divide-[var(--color-line)]">
            <Row icon={User} label="รหัสผู้ใช้" value={current.id} mono />
            <Row icon={Phone} label="เบอร์โทร" value={current.phone} />
          </Card>
        </section>

        {/* KYC + roles */}
        <section>
          <h2 className="text-lg font-bold text-ink mb-4">การยืนยันตัวตนและบทบาท</h2>
          <Card className="divide-y divide-[var(--color-line)]">
            <Row
              icon={BadgeCheck}
              label="สถานะ KYC"
              value={kyc.label}
              hint={
                current.kycStatus === "Approved"
                  ? "สามารถยื่นข้อเสนอขายได้"
                  : "ต้องยืนยันตัวตนก่อนยื่นข้อเสนอ"
              }
            />
            <Row icon={ShieldCheck} label="ผู้ดูแลระบบ" value={current.isAdmin ? "ใช่" : "ไม่ใช่"} />
            {current.isRider && <Row icon={TrendingUp} label="ไรเดอร์" value="ใช่" />}
            {current.isHubStaff && <Row icon={TrendingUp} label="พนักงานฮับ" value="ใช่" />}
          </Card>
        </section>

        {/* Credit + scores */}
        <section>
          <h2 className="text-lg font-bold text-ink mb-4">เครดิตและคะแนน</h2>
          <Card className="divide-y divide-[var(--color-line)]">
            <Row icon={Star} label="ระดับสมาชิก" value={tierLabel} />
            <Row icon={CreditCard} label="คะแนนผู้ซื้อ" value={String(current.buyerScore)} />
            <Row icon={CreditCard} label="คะแนนผู้ขาย" value={String(current.sellerScore)} />
          </Card>
          <p className="text-xs text-muted mt-2">
            ระบบเครดิตและคะแนนจะเปิดใช้งานในเฟสถัดไป
          </p>
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

const TIER_LABELS: Record<string, string> = {
  None: "สมาชิกใหม่",
  Bronze: "ระดับบรอนซ์",
  Silver: "ระดับเงิน",
  Gold: "ระดับทอง",
};

// KYC display config — fg/bg pairs that read well on a colored header pill.
const KYC_VIEW: Record<string, { label: string; fg: string; bg: string }> = {
  None: { label: "ยังไม่ยืนยันตัวตน", fg: "#1f2a1d", bg: "rgba(255,255,255,0.85)" },
  Pending: { label: "รอตรวจสอบ", fg: "#f57f17", bg: "#fff8e1" },
  Approved: { label: "ยืนยันตัวตนแล้ว", fg: "#ffffff", bg: "rgba(46,125,50,0.9)" },
  Rejected: { label: "ยืนยันไม่ผ่าน", fg: "#c62828", bg: "#ffeeee" },
};

function Row({
  icon: Icon,
  label,
  value,
  hint,
  mono = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-green-600" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm text-muted">{label}</span>
          <span
            className={`text-sm text-ink text-right break-all ${mono ? "font-mono" : "font-medium"}`}
          >
            {value}
          </span>
        </div>
        {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
      </div>
    </div>
  );
}
