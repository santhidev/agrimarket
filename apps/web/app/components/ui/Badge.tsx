type StatusKey =
  | "OPEN"
  | "MATCHED"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED"
  | "ACTIVE"
  | "PENDING"
  | "CONFIRMED"
  | "SELECTED"
  | "DECLINED";

const STATUS: Record<StatusKey, { label: string; colorVar: string; bgVar: string }> = {
  OPEN: { label: "เปิดรับ", colorVar: "--st-open", bgVar: "--st-open-bg" },
  MATCHED: { label: "จับคู่แล้ว", colorVar: "--st-matched", bgVar: "--st-matched-bg" },
  COMPLETED: { label: "เสร็จสิ้น", colorVar: "--st-completed", bgVar: "--st-completed-bg" },
  EXPIRED: { label: "หมดอายุ", colorVar: "--st-expired", bgVar: "--st-expired-bg" },
  CANCELLED: { label: "ยกเลิก", colorVar: "--st-cancelled", bgVar: "--st-cancelled-bg" },
  ACTIVE: { label: "ใช้งาน", colorVar: "--st-active", bgVar: "--st-active-bg" },
  PENDING: { label: "รอยืนยัน", colorVar: "--st-pending", bgVar: "--st-pending-bg" },
  CONFIRMED: { label: "ยืนยันแล้ว", colorVar: "--st-confirmed", bgVar: "--st-confirmed-bg" },
  SELECTED: { label: "ถูกเลือก", colorVar: "--st-selected", bgVar: "--st-selected-bg" },
  DECLINED: { label: "ปฏิเสธ", colorVar: "--st-declined", bgVar: "--st-declined-bg" },
};

export function Badge({ status }: { status: StatusKey }) {
  const s = STATUS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-chip text-xs font-semibold"
      style={{ color: `var(${s.colorVar})`, backgroundColor: `var(${s.bgVar})` }}
    >
      {/* Dot reinforces meaning so it isn't carried by color alone. */}
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: `var(${s.colorVar})` }}
        aria-hidden="true"
      />
      {s.label}
    </span>
  );
}

export type { StatusKey };
