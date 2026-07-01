import Link from "next/link";
import { ArrowRight, Plus, Shield, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { DemandCard, type Demand } from "@/app/components/cards/DemandCard";
import { ProductCard, type Product } from "@/app/components/cards/ProductCard";

const DEMANDS: Demand[] = [
  {
    id: "1",
    product: "มะม่วงน้ำดอกไม้",
    image:
      "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=400&h=220&fit=crop&auto=format",
    status: "OPEN",
    grade: "A",
    quantity: "100 กก.",
    priceLabel: "เริ่ม 22 บาท/กก.",
    deadlineLabel: "ปิดรับ 23 ชม.",
    offerCount: 12,
    distanceLabel: "5.2 กม.",
  },
  {
    id: "2",
    product: "ข้าวหอมมะลิ",
    image:
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=220&fit=crop&auto=format",
    status: "OPEN",
    grade: "มาตรฐาน",
    quantity: "500 กก.",
    priceLabel: "เริ่ม 18 บาท/กก.",
    deadlineLabel: "ปิดรับ 2 วัน",
    offerCount: 8,
    distanceLabel: "12 กม.",
  },
  {
    id: "3",
    product: "ผักคะน้า",
    image:
      "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&h=220&fit=crop&auto=format",
    status: "OPEN",
    grade: "ใหญ่",
    quantity: "50 กก.",
    priceLabel: "เริ่ม 35 บาท/กก.",
    deadlineLabel: "ปิดรับ 5 ชม.",
    offerCount: 4,
    distanceLabel: "3.1 กม.",
  },
];

const PRODUCTS: Product[] = [
  {
    id: "1",
    name: "มะม่วงน้ำดอกไม้",
    image:
      "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=300&h=300&fit=crop&auto=format",
    category: "ผลไม้",
    grades: ["A", "B", "C"],
    unit: "กิโลกรัม",
    followers: 234,
  },
  {
    id: "2",
    name: "ข้าวหอมมะลิ",
    image:
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&h=300&fit=crop&auto=format",
    category: "ข้าว",
    grades: ["มาตรฐาน"],
    unit: "กิโลกรัม",
    followers: 512,
  },
  {
    id: "3",
    name: "ผักคะน้า",
    image:
      "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=300&h=300&fit=crop&auto=format",
    category: "ผัก",
    grades: ["ใหญ่", "กลาง"],
    unit: "กิโลกรัม",
    followers: 98,
  },
  {
    id: "4",
    name: "มะนาว",
    image:
      "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=300&h=300&fit=crop&auto=format",
    category: "ผลไม้",
    grades: ["A", "B"],
    unit: "กิโลกรัม",
    followers: 176,
  },
  {
    id: "5",
    name: "พริกขี้หนู",
    image:
      "https://images.unsplash.com/photo-1583119022894-919a68a3d0e3?w=300&h=300&fit=crop&auto=format",
    category: "เครื่องเทศ",
    grades: ["มาตรฐาน"],
    unit: "กิโลกรัม",
    followers: 87,
  },
];

const CATEGORIES = [
  { label: "ผลไม้", icon: "🍎" },
  { label: "ผัก", icon: "🥦" },
  { label: "ข้าว", icon: "🌾" },
  { label: "เครื่องเทศ", icon: "🌶️" },
  { label: "ถั่ว", icon: "🌰" },
  { label: "ดอกไม้", icon: "🌸" },
];

const WHY = [
  {
    icon: TrendingUp,
    title: "ราคาดีกว่าตลาด",
    desc: "เปรียบเทียบราคาจากเกษตรกรหลายราย เลือกที่คุ้มที่สุด",
  },
  {
    icon: Shield,
    title: "ปลอดภัย น่าเชื่อถือ",
    desc: "ระบบ KYC ยืนยันตัวตน คะแนนรีวิว โปร่งใสทุกขั้นตอน",
  },
  {
    icon: Zap,
    title: "จบครบใน 3 ขั้นตอน",
    desc: "ประกาศ รอเสนอ เลือกเกษตรกร แค่นั้นเอง",
  },
];

// Marketing landing page — placeholder data (no DB rows yet). CTAs route to
// /login because posting a demand requires auth.
export default function HomePage() {
  return (
    <div className="bg-surface min-h-screen">
      <TopNav />

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 60%, #33691E 100%)",
          minHeight: 320,
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400&h=400&fit=crop&auto=format"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-15"
        />
        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-14 flex items-center justify-between gap-8">
          <div className="max-w-lg">
            <p className="text-green-100 text-sm font-semibold mb-3 tracking-wide uppercase">
              ตลาดเกษตรโดยตรง
            </p>
            <h1 className="text-white text-3xl md:text-4xl font-bold leading-tight mb-4">
              ประกาศรับซื้อ → เกษตรกรเสนอราคา → ได้ของสด ตัดพ่อค้าคนกลาง
            </h1>
            <p className="text-green-100 mb-8">ราคาดี สดใหม่จากสวน ง่ายๆ ใน 3 ขั้นตอน</p>
            <div className="flex flex-wrap gap-3">
              <Button
                href="/login"
                size="lg"
                className="bg-accent text-ink hover:opacity-90 shadow-lg"
              >
                <Plus size={18} /> ประกาศรับซื้อ
              </Button>
              <Link
                href="/login"
                className="text-white border border-white/40 rounded-xl px-5 py-3 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                เรียนรู้เพิ่มเติม
              </Link>
            </div>
          </div>

          <div className="hidden lg:block">
            <img
              src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&h=300&fit=crop&auto=format"
              alt="ผักสดจากสวน"
              className="w-72 h-56 object-cover rounded-2xl shadow-2xl opacity-90"
            />
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-12">
        {/* Categories */}
        <section>
          <h2 className="text-xl font-bold text-ink mb-5">หมวดสินค้ายอดนิยม</h2>
          <div className="flex gap-3 flex-wrap">
            {CATEGORIES.map((c) => (
              <Link
                key={c.label}
                href="/products"
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-line rounded-chip text-sm font-medium hover:border-green-600 hover:text-green-600 transition-colors shadow-sm"
              >
                <span className="text-lg" aria-hidden="true">
                  {c.icon}
                </span>{" "}
                {c.label}
              </Link>
            ))}
          </div>
        </section>

        {/* Recent demands */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-ink">รับซื้อล่าสุด</h2>
            <Link
              href="/demands"
              className="text-sm text-green-600 font-semibold hover:underline flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {DEMANDS.map((d) => (
              <DemandCard key={d.id} demand={d} />
            ))}
          </div>
        </section>

        {/* Featured products */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-ink">สินค้าแนะนำ</h2>
            <Link
              href="/products"
              className="text-sm text-green-600 font-semibold hover:underline flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {PRODUCTS.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* Why AgriMarket */}
        <section className="bg-white rounded-2xl p-6 md:p-8 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <h2 className="text-xl font-bold text-ink text-center mb-8">ทำไมต้อง AgriMarket?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {WHY.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center gap-4">
                <span className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
                  <Icon size={28} className="text-green-600" />
                </span>
                <div>
                  <h3 className="font-bold text-ink mb-1">{title}</h3>
                  <p className="text-sm text-muted">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
