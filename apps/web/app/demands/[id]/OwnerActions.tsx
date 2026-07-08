"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Share2, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/Button";

// Owner-only actions on a demand detail (Issue 08).
//
// Renders extend (PATCH deadline), cancel (DELETE → CANCELLED), and a share
// button that copies the `/d/:id` deeplink. All three are no-ops for non-owner
// viewers — the parent only renders this when `isOwner` is true, and the API
// re-checks ownership (RLS + buyer_id === session.id) on every write. The
// extend/cancel flows POST/DELETE via fetch and refresh the page on success so
// the server-rendered status + updated_at reflect the new state.
export function OwnerActions({
  demandId,
  currentDeadline,
}: {
  demandId: string;
  currentDeadline: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"extend" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extendDeadline, setExtendDeadline] = useState("");
  const [showExtend, setShowExtend] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleExtend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!extendDeadline) {
      setError("เลือกวันปิดรับใหม่ก่อน");
      return;
    }
    // datetime-local is a naive local string; the API expects an ISO timestamp.
    const deadlineIso = new Date(extendDeadline).toISOString();
    setBusy("extend");
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadline: deadlineIso }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "ขยายเวลาไม่สำเร็จ");
        return;
      }
      router.refresh();
      setShowExtend(false);
      setExtendDeadline("");
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    setError(null);
    // Plain confirm() — no design-system dialog exists yet. The action is
    // reversible only by re-creating the demand, so confirm first.
    const ok = window.confirm(
      "ยกเลิกประกาศนี้? ข้อเสนอที่กำลังดำเนินอยู่จะถูกยกเลิกด้วย"
    );
    if (!ok) return;
    setBusy("cancel");
    try {
      const res = await fetch(`/api/demands/${demandId}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "ยกเลิกไม่สำเร็จ");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setError(null);
    // `/d/:id` is the share deeplink — short, stable, redirects to detail.
    const url = `${window.location.origin}/d/${demandId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked (e.g. insecure context) — fall back to a
      // prompt so the user can still copy manually.
      window.prompt("คัดลอกลิงก์แชร์", url);
    }
  }

  return (
    <div className="space-y-4">
      {showExtend ? (
        <form
          onSubmit={handleExtend}
          className="space-y-3 p-4 border border-line rounded-xl bg-surface"
        >
          <label className="block">
            <span className="block mb-2 text-sm font-semibold text-ink">
              ขยายเวลาปิดรับถึง
            </span>
            <input
              type="datetime-local"
              value={extendDeadline}
              onChange={(e) => setExtendDeadline(e.target.value)}
              required
              className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-sm text-ink outline-none focus:border-green-600"
            />
          </label>
          <p className="text-xs text-muted">
            ปิดรับปัจจุบัน: {new Date(currentDeadline).toLocaleString("th-TH")}
          </p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy !== null}>
              บันทึก
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowExtend(false);
                setExtendDeadline("");
                setError(null);
              }}
            >
              ยกเลิก
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowExtend(true)}
            disabled={busy !== null}
          >
            <CalendarClock size={16} aria-hidden="true" /> ขยายเวลา
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={handleShare}>
            <Share2 size={16} aria-hidden="true" /> {copied ? "คัดลอกแล้ว!" : "แชร์"}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleCancel}
            disabled={busy !== null}
          >
            <Trash2 size={16} aria-hidden="true" /> ยกเลิกประกาศ
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
