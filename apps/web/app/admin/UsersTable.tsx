"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Input } from "@/app/components/ui/Input";
import { CreditTier, KycStatus } from "@agrimarket/shared";

type AdminUser = {
  id: string;
  phone: string;
  tier: string;
  kycStatus: string;
  isAdmin: boolean;
  createdAt: string;
};

type UsersResponse = {
  page: number;
  pageSize: number;
  total: number;
  users: AdminUser[];
};

const PAGE_SIZE = 20;

// Interactive users table for /admin (Issue 18). Owns its own search/filter
// state via URL-less local state (simpler than useSearchParams for v0), fetches
// /api/admin/users, and PATCHes /api/admin/users/:id/credit-tier on tier change.
export function UsersTable() {
  const [search, setSearch] = useState("");
  const [kycStatus, setKycStatus] = useState<string>("");
  const [tier, setTier] = useState<string>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (kycStatus) params.set("kycStatus", kycStatus);
    if (tier) params.set("tier", tier);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    try {
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as UsersResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [search, kycStatus, tier, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function setTierFor(userId: string, newTier: string) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/credit-tier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: newTier }),
      });
      if (!res.ok) {
        setError("ตั้ง tier ไม่สำเร็จ");
        return;
      }
      await fetchUsers();
    } catch {
      setError("ตั้ง tier ไม่สำเร็จ");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Card className="p-4 md:p-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted z-10"
            aria-hidden="true"
          />
          <Input
            placeholder="ค้นหาเบอร์โทร..."
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <select
          value={kycStatus}
          onChange={(e) => {
            setKycStatus(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-line rounded-xl bg-white"
        >
          <option value="">KYC: ทั้งหมด</option>
          <option value={KycStatus.None}>ยังไม่ยืนยัน</option>
          <option value={KycStatus.Pending}>รอตรวจสอบ</option>
          <option value={KycStatus.Approved}>ยืนยันแล้ว</option>
          <option value={KycStatus.Rejected}>ไม่ผ่าน</option>
        </select>
        <select
          value={tier}
          onChange={(e) => {
            setTier(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-line rounded-xl bg-white"
        >
          <option value="">Tier: ทั้งหมด</option>
          <option value={CreditTier.None}>สมาชิกใหม่</option>
          <option value={CreditTier.Bronze}>บรอนซ์</option>
          <option value={CreditTier.Silver}>เงิน</option>
          <option value={CreditTier.Gold}>ทอง</option>
        </select>
      </div>

      {error && <p className="text-sm text-error mb-3">{error}</p>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-line">
              <th className="py-2 pr-4 font-medium">เบอร์โทร</th>
              <th className="py-2 pr-4 font-medium">KYC</th>
              <th className="py-2 pr-4 font-medium">Tier</th>
              <th className="py-2 pr-4 font-medium">บทบาท</th>
              <th className="py-2 pr-4 font-medium">สมัครเมื่อ</th>
              <th className="py-2 font-medium">ตั้ง Tier</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  กำลังโหลด...
                </td>
              </tr>
            ) : data && data.users.length > 0 ? (
              data.users.map((u) => (
                <tr key={u.id} className="border-b border-line/60">
                  <td className="py-3 pr-4 font-medium text-ink tnum">{u.phone}</td>
                  <td className="py-3 pr-4 text-muted">{KYC_LABEL[u.kycStatus] ?? u.kycStatus}</td>
                  <td className="py-3 pr-4 text-muted">{TIER_LABEL[u.tier] ?? u.tier}</td>
                  <td className="py-3 pr-4 text-muted">{u.isAdmin ? "ผู้ดูแล" : "สมาชิก"}</td>
                  <td className="py-3 pr-4 text-muted tnum">
                    {new Date(u.createdAt).toLocaleDateString("th-TH")}
                  </td>
                  <td className="py-3">
                    <select
                      value={u.tier}
                      onChange={(e) => setTierFor(u.id, e.target.value)}
                      className="px-2 py-1 text-xs border border-line rounded-lg bg-white"
                    >
                      <option value={CreditTier.None}>สมาชิกใหม่</option>
                      <option value={CreditTier.Bronze}>บรอนซ์</option>
                      <option value={CreditTier.Silver}>เงิน</option>
                      <option value={CreditTier.Gold}>ทอง</option>
                    </select>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  ไม่พบผู้ใช้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted">
            {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} จาก {data.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-line disabled:opacity-40"
              aria-label="ก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-muted tnum">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg border border-line disabled:opacity-40"
              aria-label="ถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

const TIER_LABEL: Record<string, string> = {
  None: "สมาชิกใหม่",
  Bronze: "บรอนซ์",
  Silver: "เงิน",
  Gold: "ทอง",
};
const KYC_LABEL: Record<string, string> = {
  None: "ยังไม่ยืนยัน",
  Pending: "รอตรวจสอบ",
  Approved: "ยืนยันแล้ว",
  Rejected: "ไม่ผ่าน",
};
