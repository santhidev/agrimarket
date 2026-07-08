// Pure (type, payload) → { title, body } mapping (Issue 17).
//
// Thai user-facing strings. Missing payload fields fall back to "—" rather
// than throwing — a notification is best-effort and must never crash the
// route that emits it. An unknown type returns a safe default. Stack-
// agnostic; unit-tested here, consumed by seedNotifications() (server) and
// could be reused by the client (e.g. for legacy rows with null title/body).

import type { NotificationType } from "./types";

type Payload = Record<string, unknown>;

export function describeNotification(
  type: NotificationType,
  payload: Payload
): { title: string; body: string } {
  // Coerce common payload fields to strings with a "—" fallback so missing
  // data doesn't throw. Numbers are stringified; null/undefined → "—".
  const str = (key: string): string => {
    const v = payload[key];
    if (v === null || v === undefined) return "—";
    return String(v);
  };

  switch (type) {
    case "offer.created":
      return {
        title: "มีข้อเสนอใหม่",
        body: `คุณมีข้อเสนอใหม่บนประกาศ ${str("productName")}`,
      };
    case "offer.seller_confirmed":
      return {
        title: "เกษตรกรยืนยันการขาย",
        body: `เกษตรกรยืนยันข้อเสนอบนประกาศ ${str("productName")}`,
      };
    case "offer.seller_declined":
      return {
        title: "เกษตรกรปฏิเสธการขาย",
        body: `เกษตรกรปฏิเสธข้อเสนอบนประกาศ ${str("productName")}`,
      };
    case "offer.auto_declined":
      return {
        title: "ข้อเสนอหมดเวลา",
        body: `ข้อเสนอของคุณบน ${str("productName")} ถูกปฏิเสธอัตโนมัติ (เกิน 24 ชม.)`,
      };
    case "demand.created":
      return {
        title: "มีประกาศรับซื้อใหม่",
        body: `มีคนรับซื้อ ${str("productName")} ${str("quantity")} ${str("unit")}`,
      };
    case "demand.expired":
      return {
        title: "ประกาศหมดอายุ",
        body: `ประกาศ ${str("productName")} หมดอายุแล้ว`,
      };
    case "demand.completed":
      return {
        title: "ประกาศเสร็จสิ้น",
        body: `ประกาศ ${str("productName")} เสร็จสิ้นแล้ว`,
      };
    case "counter_offer.received":
      return {
        title: "ผู้ซื้อส่งข้อเสนอกลับ",
        body: `ผู้ซื้อต้องการ ${str("productName")} ที่ราคา ${str("price")} บาท/${str("unit")}`,
      };
    default:
      return { title: "การแจ้งเตือน", body: "" };
  }
}
