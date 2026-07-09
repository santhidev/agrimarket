import Link from "next/link";
import { ArrowRight, Carrot, Citrus, Flower2, Leaf, Plus, ShieldCheck, Sprout, TrendingUp, Users } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { DemandCard, type Demand } from "@/app/components/cards/DemandCard";
import { ProductCard, type Product } from "@/app/components/cards/ProductCard";
import { getCurrentUser } from "@/app/lib/get-profile";

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

// Category chips use Lucide icons — never emoji (emoji are font-dependent,
// inconsistent across platforms, and unthemeable).
const CATEGORIES = [
  { label: "ผลไม้", icon: Citrus },
  { label: "ผัก", icon: Carrot },
  { label: "ข้าว", icon: Sprout },
  { label: "เครื่องเทศ", icon: Leaf },
  { label: "ถั่ว", icon: Flower2 },
  { label: "ดอกไม้", icon: Flower2 },
];

const STEPS = [
  {
    n: "1",
    title: "ประกาศรับซื้อ",
    desc: "บอกชื่อสินค้า จำนวน และวันที่ต้องการ",
  },
  {
    n: "2",
    title: "เกษตรกรเสนอราคา",
    desc: "รับข้อเสนอจากเกษตรกรหลายราย เปรียบเทียบเอง",
  },
  {
    n: "3",
    title: "เลือกและติดต่อ",
    desc: "เลือกข้อเสนอที่คุ้มที่สุด ติดต่อกันตรง",
  },
];

const WHY = [
  {
    icon: TrendingUp,
    title: "ราคาดีกว่าตลาด",
    desc: "เปรียบเทียบข้อเสนอจากเกษตรกรหลายราย เลือกเองได้",
  },
  {
    icon: ShieldCheck,
    title: "น่าเชื่อถือ",
    desc: "เกษตรกรยืนยันตัวตนผ่านระบบ KYC โปร่งใสทุกขั้นตอน",
  },
  {
    icon: Users,
    title: "ซื้อขายกันตรง",
    desc: "คุยกับเกษตรกรโดยตรง ไม่ต้องผ่านคนกลาง",
  },
];

// Marketing landing page — placeholder data (no DB rows yet). The primary CTA
// routes to /demands/new for signed-in buyers, /login otherwise.
export default async function HomePage() {
  const current = await getCurrentUser();
  const primaryHref = current ? "/demands/new" : "/login";

  return (
    <div className="bg-surface min-h-screen">
      <TopNav isLoggedIn={!!current} userName={current?.phone} userId={current?.id} />

      {/* Hero — calm, content-first. No gradient backdrop or stock overlay. */}
      <section className="border-b border-line">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-14 md:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-chip">
              <Leaf size={12} aria-hidden="true" />
              ตลาดเกษตรซื้อขายตรง
            </span>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold text-ink leading-tight">
              ซื้อขายผลผลิตเกษตร
              <br />
              ระหว่างผู้ซื้อกับเกษตรกร
            </h1>
            <p className="mt-4 text-base md:text-lg text-muted leading-relaxed">
              ประกาศรับซื้อ เกษตรกรเสนอราคา เลือกข้อเสนอที่คุ้มที่สุด
              ไม่ต้องผ่านคนกลาง
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href={primaryHref} size="lg">
                <Plus size={18} aria-hidden="true" />
                เริ่มประกาศรับซื้อ
              </Button>
              <Button href="/products" variant="secondary" size="lg">
                ดูสินค้า
              </Button>
            </div>
          </div>

          <div className="hidden lg:block">
            <img
              src="https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600&h=440&fit=crop&auto=format"
              alt="สวนผักสดจากฟาร์ม"
              className="w-full h-[440px] object-cover rounded-card shadow-md"
              loading="eager"
            />
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-16 space-y-14 md:space-y-20">
        {/* How it works — 3 steps, no flashy icon boxes */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-ink text-center mb-10">
            ง่าย 3 ขั้นตอน
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-4">
                <span className="shrink-0 w-9 h-9 rounded-full bg-green-700 text-white font-bold text-sm flex items-center justify-center tnum">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{s.title}</h3>
                  <p className="text-sm text-muted mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Categories — Lucide icons, never emoji */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-ink mb-5">หมวดสินค้า</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {CATEGORIES.map(({ label, icon: Icon }) => (
              <Link
                key={label}
                href="/products"
                className="flex flex-col items-center gap-2 py-4 bg-white border border-line rounded-card hover:border-green-200 hover:shadow-sm transition-all"
              >
                <Icon size={24} className="text-green-700" aria-hidden="true" />
                <span className="text-sm font-medium text-ink">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent demands */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl md:text-2xl font-bold text-ink">รับซื้อล่าสุด</h2>
            <Link
              href="/demands"
              className="text-sm text-green-700 font-semibold hover:underline flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight size={14} aria-hidden="true" />
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
            <h2 className="text-xl md:text-2xl font-bold text-ink">สินค้าแนะนำ</h2>
            <Link
              href="/products"
              className="text-sm text-green-700 font-semibold hover:underline flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {PRODUCTS.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* Why AgriMarket — clean rows, single-stroke icons */}
        <section className="bg-white rounded-card border border-line p-6 md:p-10">
          <h2 className="text-xl md:text-2xl font-bold text-ink text-center mb-10">
            ทำไมต้อง AgriMarket?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {WHY.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center gap-3">
                <Icon size={32} className="text-green-700" aria-hidden="true" strokeWidth={1.5} />
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="text-sm text-muted leading-relaxed max-w-xs">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
