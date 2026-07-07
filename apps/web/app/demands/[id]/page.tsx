import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, MapPin, Package } from "lucide-react";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import {
  DEMAND_SELECT,
  mapDemand,
  type DemandRow,
} from "@/app/api/demands/mapping";
import { OwnerActions } from "./OwnerActions";

// Demand detail page (Issue 07, extended 08).
//
// Reads a single demand server-side. OPEN demands are public; non-OPEN demands
// are owner-or-admin (RLS), so a hidden row reads as null and surfaces as a
// 404 via notFound() — existence is never leaked. Offers are not a table yet
// (#10); the page renders an empty-state placeholder where the offer list will
// go.
//
// Issue 08 adds the owner-action bar (extend deadline / cancel / share). The
// bar renders only when the viewer is the demand's buyer; the API re-checks
// ownership (RLS + buyer_id === session.id) on every write, so a forged client
// can't escalate. A non-owner (or anon) viewer sees the read-only detail.
export default async function DemandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await createInsForgeServerClient();

  const { data, error } = await client.database
    .from("demands")
    .select(DEMAND_SELECT)
    .eq("id", id)
    .single();

  const row = (data as unknown as DemandRow | null) ?? null;
  if (!row || error) {
    notFound();
  }

  const demand = mapDemand(row);
  const current = await getCurrentUser();
  const isOwner = !!current && current.id === demand.buyerId;

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <TopNav isLoggedIn={!!current} userName={current?.phone} />

      <main className="max-w-3xl mx-auto w-full px-4 md:px-8 py-8 flex-1 space-y-6">
        <div>
          <Link
            href="/demands"
            className="text-sm font-semibold text-green-600 hover:text-green-700"
          >
            ← กลับสู่รายการรับซื้อ
          </Link>
        </div>

        <Card className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-ink">{demand.productName}</h1>
              <p className="text-sm text-muted mt-1">
                รับซื้อ {demand.quantity} {demand.unit}
              </p>
            </div>
            <Badge status={demand.status as "OPEN"} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DetailRow
              icon={<Package size={16} className="text-green-600" />}
              label="ปริมาณรับซื้อ"
              value={`${demand.quantity} ${demand.unit}`}
            />
            <DetailRow
              icon={<Package size={16} className="text-green-600" />}
              label="คงเหลือ (ยังไม่ได้จับคู่)"
              value={`${demand.pendingQuantity} ${demand.unit}`}
            />
            <DetailRow
              icon={<Calendar size={16} className="text-green-600" />}
              label="ปิดรับเมื่อ"
              value={new Date(demand.deadline).toLocaleString("th-TH")}
            />
            <DetailRow
              icon={<MapPin size={16} className="text-green-600" />}
              label="พิกัดรับสินค้า"
              value={`${demand.buyerLat.toFixed(4)}, ${demand.buyerLng.toFixed(4)}`}
            />
          </div>
        </Card>

        {/* Offer list placeholder — Issue #10 wires the real offers in. */}
        <Card className="p-6">
          <h2 className="text-lg font-bold text-ink mb-3">ข้อเสนอขาย</h2>
          {demand.offers.length === 0 ? (
            <p className="text-sm text-muted">
              ยังไม่มีข้อเสนอ — รอเกษตรกรเสนอราคา
            </p>
          ) : null}
        </Card>

        {isOwner ? (
          <Card className="p-6">
            <h2 className="text-lg font-bold text-ink mb-3">จัดการประกาศ</h2>
            <OwnerActions
              demandId={demand.id}
              currentDeadline={demand.deadline}
            />
          </Card>
        ) : null}

        <div className="flex gap-3">
          <Button href={current ? `/demands/${demand.id}` : "/login"} variant="primary">
            เสนอขาย
          </Button>
          <Button href="/demands" variant="outline">
            ดูประกาศอื่น
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-medium text-ink break-all">{value}</p>
      </div>
    </div>
  );
}
