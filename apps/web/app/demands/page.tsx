import Link from "next/link";
import { ArrowLeft, Megaphone, Plus } from "lucide-react";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { DemandCard, type Demand } from "@/app/components/cards/DemandCard";
import {
  DEMAND_SELECT,
  type DemandRow,
} from "@/app/api/demands/mapping";

// Public demand browse page (Issue 07).
//
// The marketplace list: OPEN demands newest first. Reads via the InsForge
// server client — anonymous viewers see OPEN rows (RLS), so no login is
// required to browse. A signed-in viewer gets a "ประกาศรับซื้อ" CTA that drops
// them at the create form; an anonymous viewer is routed to /login first
// (posting a demand is buyer-only, so the gate is auth, not browse).
export default async function DemandsPage() {
  const client = await createInsForgeServerClient();

  // Public browse shows OPEN only — non-OPEN rows are owner-or-admin (RLS hides
  // them from anon callers), and the marketplace view is "what can I sell into
  // right now", not a buyer's history.
  const { data, error } = await client.database
    .from("demands")
    .select(DEMAND_SELECT)
    .eq("status", "OPEN")
    .order("created_at", { ascending: false });

  const current = await getCurrentUser();

  if (error) {
    return (
      <div className="bg-surface min-h-screen">
        <TopNav isLoggedIn={!!current} userName={current?.phone} userId={current?.id} />
        <main className="max-w-6xl mx-auto px-4 md:px-8 py-16 text-center">
          <p className="text-error">ไม่สามารถโหลดรายการประกาศรับซื้อได้</p>
        </main>
        <Footer />
      </div>
    );
  }

  const rows = (data ?? []) as unknown as DemandRow[];

  // Map DB rows to the DemandCard display shape. Image/price/distance are not
  // modelled on a demand yet (no offer prices to start from, and distance needs
  // the viewer's lat/lng) — render neutral placeholders so the card still reads
  // cleanly. Offer count comes from #10.
  const cards: Demand[] = rows.map((row) => ({
    id: row.id,
    product: row.product.name,
    image: "",
    status: "OPEN",
    grade: "มาตรฐาน",
    quantity: `${row.quantity} ${row.product.unit}`,
    priceLabel: "รอเกษตรกรเสนอราคา",
    deadlineLabel: formatDeadline(row.deadline),
    offerCount: 0,
    distanceLabel: "—",
  }));

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <TopNav isLoggedIn={!!current} userName={current?.phone} userId={current?.id} />

      <header className="bg-white border-b border-line">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Megaphone size={20} className="text-green-700" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-ink">ประกาศรับซื้อ</h1>
              <p className="text-sm text-muted">เปิดรับอยู่ {cards.length} รายการ</p>
            </div>
          </div>
          <Link
            href={current ? "/demands/new" : "/login"}
            className="inline-flex items-center gap-2 bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors active:scale-[0.98]"
          >
            <Plus size={16} aria-hidden="true" /> ประกาศรับซื้อ
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 md:px-8 py-8 flex-1">
        {cards.length === 0 ? (
          <div className="text-center py-20 text-muted">
            ยังไม่มีประกาศรับซื้อ — เป็นคนแรกที่ประกาศ
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {cards.map((d) => (
              <DemandCard key={d.id} demand={d} />
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:text-green-600"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            กลับหน้าแรก
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Render a deadline as a short "อีก N วัน/ชม." label. Demand browse is a
// glanceable list — the exact timestamp is on the detail page.
function formatDeadline(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "ปิดรับแล้ว";
  const hours = ms / 3_600_000;
  if (hours < 24) return `ปิดรับ ${Math.round(hours)} ชม.`;
  const days = Math.round(hours / 24);
  return `ปิดรับ ${days} วัน`;
}
