"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Filter, Leaf, Plus, Search } from "lucide-react";
import { signOutAction } from "@/app/login/actions";
import { Avatar } from "@/app/components/ui/Avatar";

/**
 * Sticky global top navigation. Auth-aware: shows the avatar + menu when a
 * signed-in user is supplied, otherwise shows a "เข้าสู่ระบบ" link.
 *
 * Navigation links to /demands and /products point at routes that don't exist
 * yet (later issues) — they're stubbed so the chrome renders correctly.
 */
export function TopNav({ isLoggedIn = false, userName = "" }: { isLoggedIn?: boolean; userName?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-line h-16 flex items-center px-4 md:px-8 gap-3 md:gap-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <span className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
          <Leaf size={16} className="text-white" />
        </span>
        <span className="font-bold text-green-600 text-lg">AgriMarket</span>
      </Link>

      {/* Main menu */}
      <div className="hidden md:flex items-center gap-1">
        {[
          { label: "หน้าแรก", href: "/" },
          { label: "รับซื้อ", href: "/demands" },
          { label: "สินค้า", href: "/products" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-ink hover:bg-surface transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Search */}
      <div className="hidden sm:flex flex-1 items-center gap-2 bg-surface rounded-xl px-3 py-2 border border-line max-w-lg">
        <Search size={16} className="text-muted" />
        <input
          placeholder="ค้นหาสินค้า, ประกาศรับซื้อ..."
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted"
        />
        <button
          type="button"
          className="text-muted bg-white border border-line rounded-lg p-1.5"
          aria-label="ตัวกรอง"
        >
          <Filter size={12} />
        </button>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2 md:gap-3 ml-auto shrink-0">
        <Link href="/login" className="relative p-2 hover:bg-surface rounded-lg" aria-label="แจ้งเตือน">
          <Bell size={20} className="text-ink" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error" />
        </Link>

        <Link
          href={isLoggedIn ? "/dashboard" : "/login"}
          className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          <Plus size={16} />
          <span className="hidden lg:inline">ประกาศ</span>
        </Link>

        {isLoggedIn ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 p-1.5 hover:bg-surface rounded-xl"
              aria-expanded={menuOpen}
            >
              <Avatar name={userName} size="sm" />
              <ChevronDown size={14} className="text-muted" />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 mt-2 z-50 bg-white border border-line rounded-xl shadow-lg py-1 w-48">
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
            className="hidden sm:inline text-sm font-medium text-ink hover:text-green-600 transition-colors"
          >
            เข้าสู่ระบบ
          </Link>
        )}
      </div>
    </nav>
  );
}
