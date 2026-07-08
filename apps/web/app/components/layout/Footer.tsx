import Link from "next/link";
import { Leaf } from "lucide-react";

const FOOTER_LINKS = ["เกี่ยวกับ", "วิธีใช้งาน", "นโยบาย", "ติดต่อ"];

export function Footer() {
  return (
    <footer className="border-t border-line mt-16 py-10 px-4 md:px-8 bg-surface">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="AgriMarket หน้าแรก">
          <span className="w-7 h-7 rounded-lg bg-green-700 flex items-center justify-center">
            <Leaf size={14} className="text-white" aria-hidden="true" />
          </span>
          <span className="font-bold text-green-700">AgriMarket</span>
        </Link>

        <nav className="flex gap-6 text-sm text-muted">
          {FOOTER_LINKS.map((label) => (
            <Link key={label} href="/" className="hover:text-green-700 transition-colors">
              {label}
            </Link>
          ))}
        </nav>

        <p className="text-xs text-muted">© 2025 AgriMarket. สงวนสิทธิ์ทุกประการ.</p>
      </div>
    </footer>
  );
}
