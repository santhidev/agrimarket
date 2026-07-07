import { DemandStatus } from "./enums";

// Demand background-job predicates (Issue 09).
//
// Two recurring jobs drive the demand lifecycle's time-based exits:
//   - expire:   OPEN + deadline passed    → EXPIRED (every 5 min)
//   - complete: MATCHED + 7 days old       → COMPLETED (hourly)
//
// The cron routes do the coarse row filter in SQL (uses the existing
// demands_status_idx), then re-check each candidate row with these pure
// predicates before UPDATE. The re-check is what makes a tick idempotent: a row
// that raced past its transition (buyer extended the deadline between SELECT
// and UPDATE, or a prior tick already moved it) is skipped instead of touched
// twice — so re-running a tick is a no-op and never emits a duplicate
// notification.

// --- Auto-complete threshold ------------------------------------------------

/// A MATCHED demand auto-completes once it has been MATCHED for at least 7
/// days (CONTEXT.md "State Machines": "Auto-complete 7 วัน"). Extracted as a
/// constant so the route and the unit test share the exact threshold.
export const COMPLETE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

// --- Should this OPEN demand be expired? -------------------------------------

/// True only for an OPEN demand whose deadline is strictly in the past. The
/// route's SQL already filters `status='OPEN' AND deadline < now()`; this is
/// the per-row TS re-check that guards against a mid-tick race (deadline got
/// extended) and a re-run after the row already moved. An unparseable deadline
/// parses to NaN, compares false, and skips safely.
export function shouldExpireDemand(
  row: { status: string; deadline: string },
  now: Date
): boolean {
  if (row.status !== DemandStatus.Open) return false;
  const deadline = Date.parse(row.deadline);
  if (Number.isNaN(deadline)) return false;
  return deadline < now.getTime();
}

// --- Should this MATCHED demand be completed? --------------------------------

/// True only for a MATCHED demand whose updated_at is at least COMPLETE_AFTER_MS
/// in the past. The route's SQL already filters `status='MATCHED'`; the 7-day
/// cut lives here (not in SQL) so the constant is unit-tested and the route's
/// query stays portable. Same idempotency shape as expire: a row that already
/// left MATCHED (prior tick, or buyer somehow re-opened) is skipped.
export function shouldCompleteDemand(
  row: { status: string; updatedAt: string },
  now: Date
): boolean {
  if (row.status !== DemandStatus.Matched) return false;
  const updatedAt = Date.parse(row.updatedAt);
  if (Number.isNaN(updatedAt)) return false;
  return now.getTime() - updatedAt >= COMPLETE_AFTER_MS;
}
