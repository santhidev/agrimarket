import Link from "next/link";
import { Leaf } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-surface border-t border-line mt-16 py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center">
            <Leaf size={14} className="text-white" />
          </span>
          <span className="font-bold text-green-600">AgriMarket</span>
        </Link>

        <nav className="flex gap-6 text-sm text-muted">
          {["เกี่ยวกับ", "วิธีใช้งาน", "นโยบาย", "ติดต่อ"].map((label) => (
            <Link key={label} href="/" className="hover:text-green-600 transition-colors">
              {label}
            </Link>
          ))}
        </nav>

        <p className="text-xs text-muted">© 2025 AgriMarket. สงวนสิทธิ์ทุกประการ.</p>
      </div>
    </footer>
  );
}
