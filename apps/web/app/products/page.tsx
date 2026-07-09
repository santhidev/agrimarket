import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { ProductCard } from "@/app/components/cards/ProductCard";
import { withDefaultGrade } from "@agrimarket/shared";

import { PRODUCT_SELECT, GRADE_SELECT, type ProductRow, type ProductGradeRow } from "@/app/api/catalog/mapping";

// Public catalog browse page (Issue 04).
//
// Reads public.products + public.product_grades server-side via the InsForge
// server client (RLS allows anon reads on the catalog). No login required —
// the page renders for everyone, matching the "Browse page renders products +
// grades" acceptance criterion.
export default async function ProductsPage() {
  const client = await createInsForgeServerClient();
  const current = await getCurrentUser();

  const [{ data: productData, error: productError }, gradeResult] = await Promise.all([
    client.database
      .from("products")
      .select(PRODUCT_SELECT)
      .order("created_at", { ascending: false }),
    client.database
      .from("product_grades")
      .select(GRADE_SELECT)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (productError) {
    return (
      <div className="bg-surface min-h-screen">
        <TopNav isLoggedIn={!!current} userName={current?.phone} userId={current?.id} />
        <main className="max-w-6xl mx-auto px-4 md:px-8 py-16 text-center">
          <p className="text-error">ไม่สามารถโหลดรายการสินค้าได้</p>
        </main>
        <Footer />
      </div>
    );
  }

  const products = (productData ?? []) as ProductRow[];
  const gradeRows = (gradeResult.data ?? []) as ProductGradeRow[];

  // Group grades by product_id once, then apply the default-grade fallback so
  // products without explicit grades still show "มาตรฐาน" (CONTEXT.md).
  const gradesByProduct = new Map<string, string[]>();
  for (const g of gradeRows) {
    const list = gradesByProduct.get(g.product_id) ?? [];
    list.push(g.name);
    gradesByProduct.set(g.product_id, list);
  }

  const cards = products.map((p) => ({
    id: p.id,
    name: p.name,
    image: "", // ProductCard shows a green placeholder when image is empty
    category: p.category,
    grades: withDefaultGrade((gradesByProduct.get(p.id) ?? []).map((name) => ({ name }))).map(
      (g) => g.name
    ),
    unit: p.unit,
    followers: 0, // Issue 16 (Follow) wires the real count.
  }));

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <TopNav isLoggedIn={!!current} userName={current?.phone} userId={current?.id} />

      <header className="bg-white border-b border-line">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Package size={20} className="text-green-700" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-ink">คลังสินค้าเกษตร</h1>
            <p className="text-sm text-muted">สินค้าทั้งหมด {products.length} รายการ</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 md:px-8 py-8 flex-1">
        {cards.length === 0 ? (
          <div className="text-center py-20 text-muted">ยังไม่มีสินค้าในระบบ</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {cards.map((p) => (
              <ProductCard key={p.id} product={p} />
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
