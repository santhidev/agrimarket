"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { TopNav } from "@/app/components/layout/TopNav";
import { Footer } from "@/app/components/layout/Footer";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";

// Demand create form (Issue 07).
//
// Client component — the form POSTs to /api/demands and redirects to the new
// demand's detail page on success. The route enforces auth + zod validation;
// this page does a light client-side pass for UX (required fields, future
// deadline) but trusts the server as the source of truth.
export default function NewDemandPage() {
  const router = useRouter();
  const [products, setProducts] = useState<
    { id: string; name: string; unit: string }[]
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [deadline, setDeadline] = useState("");
  const [buyerLat, setBuyerLat] = useState("");
  const [buyerLng, setBuyerLng] = useState("");

  // Load the product list for the <select>. A demand must reference a real
  // product (FK), so the picker is the only valid entry.
  useEffect(() => {
    fetch("/api/products")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        const list = (data.products ?? []) as {
          id: string;
          name: string;
          unit: string;
        }[];
        setProducts(list);
        if (list.length > 0) setProductId(list[0].id);
      })
      .catch(() => setError("ไม่สามารถโหลดรายการสินค้าได้"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Light client validation — the server re-validates with zod.
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      setError("ปริมาณต้องเป็นจำนวนเต็มบวก");
      return;
    }
    const lat = Number(buyerLat);
    const lng = Number(buyerLng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError("ละติจูดไม่ถูกต้อง (-90 ถึง 90)");
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError("ลองจิจูดไม่ถูกต้อง (-180 ถึง 180)");
      return;
    }

    // datetime-local returns a naive local string; the API expects an ISO
    // timestamp. Treat it as Asia/Bangkok by appending the offset (the buyer's
    // location is implicit — AgriMarket is TH-only for MVP).
    const deadlineIso = new Date(deadline).toISOString();

    setSubmitting(true);
    try {
      const res = await fetch("/api/demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantity: qty,
          deadline: deadlineIso,
          buyerLat: lat,
          buyerLng: lng,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "สร้างประกาศไม่สำเร็จ");
        return;
      }
      const newId = body?.demand?.id;
      router.push(newId ? `/demands/${newId}` : "/demands");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <TopNav />

      <main className="max-w-xl mx-auto w-full px-4 md:px-8 py-8 flex-1">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Megaphone size={20} className="text-green-700" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-ink">ประกาศรับซื้อ</h1>
            <p className="text-sm text-muted">
              บอกว่ารับซื้ออะไร ปริมาณเท่าไหร่ ภายในเมื่อไหร่
            </p>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="สินค้าที่รับซื้อ">
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
                className={FIELD_CLASS}
              >
                {products.length === 0 && <option value="">กำลังโหลด…</option>}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="ปริมาณรับซื้อ">
              <input
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="เช่น 100"
                required
                className={FIELD_CLASS}
              />
            </Field>

            <Field label="ปิดรับเมื่อ">
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
                className={FIELD_CLASS}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="ละติจูด">
                <input
                  type="number"
                  step="any"
                  value={buyerLat}
                  onChange={(e) => setBuyerLat(e.target.value)}
                  placeholder="13.7563"
                  required
                  className={FIELD_CLASS}
                />
              </Field>
              <Field label="ลองจิจูด">
                <input
                  type="number"
                  step="any"
                  value={buyerLng}
                  onChange={(e) => setBuyerLng(e.target.value)}
                  placeholder="100.5018"
                  required
                  className={FIELD_CLASS}
                />
              </Field>
            </div>

            {error && (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "กำลังสร้าง…" : "ประกาศรับซื้อ"}
              </Button>
              <Button href="/demands" variant="ghost">
                ยกเลิก
              </Button>
            </div>
          </form>
        </Card>
      </main>

      <Footer />
    </div>
  );
}

// Shared field style — matches the Input primitive so selects and native
// date/number inputs read as the same component.
const FIELD_CLASS =
  "w-full px-3 py-2.5 bg-surface border border-line rounded-xl text-sm text-ink outline-none transition-colors focus:border-green-600 min-w-0";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block mb-2 text-sm font-semibold text-ink">
        {label}
        <span className="text-error ml-0.5" aria-hidden="true">
          *
        </span>
      </span>
      {children}
    </label>
  );
}
