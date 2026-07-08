import { OfferStatus } from "./enums";

// Offer background-job predicate (Issue 15).
//
// The select → confirm handshake has a wall-clock exit: once the buyer selects
// (POST /api/demands/:id/select → PENDING_SELLER_CONFIRMATION), each chosen
// seller must confirm (confirm-sale → CONFIRMED) or decline (decline-sale →
// DECLINED) within 24 hours. If a seller doesn't respond in time, the recurring
// decline job flips the stale PENDING_SELLER_CONFIRMATION offer to DECLINED so
// the buyer can re-select from the rest (CONTEXT.md "Seller ยืนยันขายใน 24 ชม.
// → เกิน = auto DECLINED").
//
// The cron route does the coarse row filter in SQL
// (`status='PENDING_SELLER_CONFIRMATION'`), then re-checks each candidate row
// with this pure predicate before UPDATE. The re-check is what makes a tick
// idempotent: a row that raced (seller confirmed between SELECT and UPDATE) or
// that a prior tick already moved is skipped instead of touched twice — so
// re-running a tick is a no-op and never emits a duplicate notification.

// --- Auto-decline threshold -------------------------------------------------

/// A PENDING_SELLER_CONFIRMATION offer auto-declines once it has been in that
/// state for at least 24 hours (CONTEXT.md "Seller ยืนยันขายใน 24 ชม."). Uses
/// updated_at as the "pending since" clock — the offers table has no dedicated
/// pending_since column, and the demand lifecycle's complete job already uses
/// updated_at the same way (see demand-jobs.ts COMPLETE_AFTER_MS). Extracted as
/// a constant so the route and the unit test share the exact threshold.
export const DECLINE_AFTER_MS = 24 * 60 * 60 * 1000;

// --- Should this PENDING offer be declined? ---------------------------------

/// True only for a PENDING_SELLER_CONFIRMATION offer whose updated_at is at
/// least DECLINE_AFTER_MS in the past. The route's SQL already filters
/// `status='PENDING_SELLER_CONFIRMATION'`; the 24-hour cut lives here (not in
/// SQL) so the constant is unit-tested and the query stays portable. updated_at
/// bumps on any write, but the status filter runs first — a CONFIRMED offer
/// (updated_at bumped by the confirm) is excluded by status before the age
/// check. Same idempotency shape as shouldCompleteDemand: a row that already
/// left PENDING (prior tick, or seller confirmed) is skipped. An unparseable
/// updated_at parses to NaN and skips safely.
export function shouldDeclineOffer(
  row: { status: string; updatedAt: string },
  now: Date
): boolean {
  if (row.status !== OfferStatus.PendingSellerConfirmation) return false;
  const updatedAt = Date.parse(row.updatedAt);
  if (Number.isNaN(updatedAt)) return false;
  return now.getTime() - updatedAt >= DECLINE_AFTER_MS;
}
