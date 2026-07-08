"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { insforge } from "@/app/lib/insforge-client";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

/**
 * Bell icon + unread badge + dropdown of the 5 most recent notifications.
 * Subscribes to the user's realtime channel ("notif:<userId>") so new rows
 * arrive instantly. The userId prop comes from the Server Component parent
 * (already-resolved), avoiding the "event arrives before auth hydrated"
 * race called out by the insforge realtime skill.
 */
export function NotificationsBell({ userId }: { userId: string }) {
  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const channel = `notif:${userId}`;
  const connectedRef = useRef(false);

  const loadRecent = useCallback(async () => {
    const res = await fetch("/api/notifications?limit=5");
    if (!res.ok) return;
    const json = (await res.json()) as {
      notifications: NotificationItem[];
      unreadCount: number;
    };
    setRecent(json.notifications);
    setUnread(json.unreadCount);
  }, []);

  useEffect(() => {
    void loadRecent();

    // Realtime: connect + subscribe + listen.
    const sub = async () => {
      try {
        await insforge.realtime.connect();
        const response = await insforge.realtime.subscribe(channel);
        if (!response.ok) return;
        connectedRef.current = true;

        insforge.realtime.on("notification:new", (payload: NotificationItem) => {
          setRecent((prev) => [payload, ...prev].slice(0, 5));
          setUnread((c) => c + 1);
        });
      } catch {
        // best-effort; the next route navigation will re-fetch via SSR.
      }
    };
    void sub();

    return () => {
      try {
        if (connectedRef.current) {
          insforge.realtime.unsubscribe(channel);
        }
      } catch {}
    };
  }, [channel, loadRecent]);

  const markRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setRecent((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: "read" } : n))
    );
    setUnread((c) => Math.max(0, c - 1));
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-surface text-ink"
        aria-label="แจ้งเตือน"
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 mt-2 z-50 bg-white border border-line rounded-xl shadow-md w-80 max-h-96 overflow-auto">
            {recent.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted text-center">
                ยังไม่มีการแจ้งเตือน
              </p>
            ) : (
              <>
                {recent.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void markRead(n.id)}
                    className={`block w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-surface ${
                      n.readAt ? "" : "bg-green-50/40"
                    }`}
                  >
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                  </button>
                ))}
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-green-700 hover:bg-surface text-center"
                >
                  ดูทั้งหมด
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
