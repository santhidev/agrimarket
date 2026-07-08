// Admin dashboard metric calculations (Issue 18).
//
// These are PURE functions over raw counts the route loads from the DB. Keeping
// the math here (not in the route) means the edge cases — zero denominators,
// OPEN excluded from the transaction-success denominator — are unit-tested
// rather than proved by a live curl. The route's only job is to fetch the
// counts; this file decides what they mean.

/// Per-status demand counts. The route loads these with five `count: 'exact'`
/// queries against public.demands.
export interface DemandCounts {
  open: number;
  matched: number;
  completed: number;
  expired: number;
  cancelled: number;
}

// Clamp to [0, ∞) so a stray negative count can't make a rate negative.
function clampNonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/// Fulfillment rate = (matched + completed) / total. Top-of-funnel health: of
/// every demand ever posted, how many reached a deal. OPEN stays in the
/// denominator (it hasn't resolved yet). 0 when no demands exist.
export function computeFulfillmentRate(c: DemandCounts): number {
  const matched = clampNonNeg(c.matched);
  const completed = clampNonNeg(c.completed);
  const total =
    clampNonNeg(c.open) +
    matched +
    completed +
    clampNonNeg(c.expired) +
    clampNonNeg(c.cancelled);
  if (total === 0) return 0;
  return (matched + completed) / total;
}

/// Transaction success = (matched + completed) / terminal total. Of demands
/// that FINISHED (matched + completed + expired + cancelled), how many closed
/// well. OPEN is excluded — it hasn't finished. 0 when no terminal demands.
export function computeTransactionSuccess(c: DemandCounts): number {
  const matched = clampNonNeg(c.matched);
  const completed = clampNonNeg(c.completed);
  const expired = clampNonNeg(c.expired);
  const cancelled = clampNonNeg(c.cancelled);
  const terminal = matched + completed + expired + cancelled;
  if (terminal === 0) return 0;
  return (matched + completed) / terminal;
}

/// Repeat rate = buyersWith2Plus / totalBuyers. Buyer retention: of distinct
/// buyers, how many posted 2+ demands. 0 when there are no buyers.
export function computeRepeatRate(
  totalBuyers: number,
  buyersWith2Plus: number
): number {
  const tb = clampNonNeg(totalBuyers);
  const r = clampNonNeg(buyersWith2Plus);
  if (tb === 0) return 0;
  return Math.min(r / tb, 1);
}
