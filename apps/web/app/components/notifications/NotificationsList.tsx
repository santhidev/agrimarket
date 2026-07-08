"use client";

import { useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

/**
 * Full-page list with interactive mark-as-read. Receives the initial list from
 * the Server Component page (SSR fetch), then handles read mutations client-
 * side. "อ่านทั้งหมด" calls the read-all endpoint and flips every row locally.
 */
export function NotificationsList({
  initial,
}: {
  initial: NotificationItem[];
}) {
  const [items, setItems] = useState(initial);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: "read" } : n))
    );
  };

  const markAll = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setItems((prev) => prev.map((n) => ({ ...n, readAt: "read" })));
  };

  const hasUnread = items.some((n) => !n.readAt);

  return (
    <div className="space-y-3">
      {hasUnread && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={markAll}
            className="text-sm font-semibold text-green-700 hover:text-green-600"
          >
            อ่านทั้งหมด
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-center text-muted py-12">ยังไม่มีการแจ้งเตือน</p>
      ) : (
        items.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => !n.readAt && void markRead(n.id)}
            className={`block w-full text-left p-4 rounded-xl border border-line hover:bg-surface ${
              n.readAt ? "" : "bg-green-50/40"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{n.title}</p>
              {!n.readAt && (
                <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted mt-1">{n.body}</p>
            <p className="text-xs text-muted/70 mt-1">
              {new Date(n.createdAt).toLocaleString("th-TH")}
            </p>
          </button>
        ))
      )}
    </div>
  );
}
