"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Leaf, Plus } from "lucide-react";
import { signOutAction } from "@/app/login/actions";
import { Avatar } from "@/app/components/ui/Avatar";

const NAV_ITEMS = [
  { label: "หน้าแรก", href: "/" },
  { label: "รับซื้อ", href: "/demands" },
  { label: "สินค้า", href: "/products" },
];

/**
 * Sticky global top navigation. Auth-aware: shows the avatar + menu when a
 * signed-in user is supplied, otherwise shows a "เข้าสู่ระบบ" link.
 *
 * Search/filter are intentionally omitted until they're wired to a real
 * query — a non-functional search box reads as a mockup.
 */
export function TopNav({
  isLoggedIn = false,
  userName = "",
}: {
  isLoggedIn?: boolean;
  userName?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line h-16 flex items-center px-4 md:px-8 gap-4 md:gap-6">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0 rounded-lg" aria-label="AgriMarket หน้าแรก">
        <span className="w-8 h-8 rounded-lg bg-green-700 flex items-center justify-center">
          <Leaf size={16} className="text-white" aria-hidden="true" />
        </span>
        <span className="font-bold text-green-700 text-lg">AgriMarket</span>
      </Link>

      {/* Main menu */}
      <div className="hidden md:flex items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-surface hover:text-green-700 transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-1 md:gap-2 ml-auto shrink-0">
        <Link
          href={isLoggedIn ? "/dashboard" : "/login"}
          className="relative p-2 rounded-lg hover:bg-surface text-ink"
          aria-label="แจ้งเตือน"
        >
          <Bell size={20} aria-hidden="true" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
        </Link>

        <Link
          href={isLoggedIn ? "/demands/new" : "/login"}
          className="hidden sm:inline-flex items-center gap-1.5 bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors active:scale-[0.98]"
        >
          <Plus size={16} aria-hidden="true" />
          <span>ประกาศรับซื้อ</span>
        </Link>

        {isLoggedIn ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1 p-1.5 hover:bg-surface rounded-xl"
              aria-expanded={menuOpen}
              aria-label="เมนูบัญชี"
            >
              <Avatar name={userName} size="sm" />
              <ChevronDown size={14} className="text-muted" aria-hidden="true" />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 mt-2 z-50 bg-white border border-line rounded-xl shadow-md py-1 w-48">
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-ink hover:bg-surface"
                  >
                    โปรไฟล์
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-ink hover:bg-surface"
                  >
                    ข้อเสนอของฉัน
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-ink hover:bg-surface"
                  >
                    ประกาศของฉัน
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-ink hover:bg-surface"
                  >
                    KYC
                  </Link>
                  <div className="my-1 border-t border-line" />
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="w-full text-left px-4 py-2 text-sm text-error hover:bg-surface"
                    >
                      ออกจากระบบ
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center px-3 py-2 text-sm font-semibold text-ink hover:text-green-700 transition-colors"
          >
            เข้าสู่ระบบ
          </Link>
        )}
      </div>
    </nav>
  );
}
