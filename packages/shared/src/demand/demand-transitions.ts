import { DemandStatus } from "./enums";

// Pure demand lifecycle helpers (Issue 07).
//
// pending_quantity tracks how much of the demanded quantity is still
// uncommitted: it starts at `quantity` and drops as offers become
// PENDING_SELLER_CONFIRMATION / CONFIRMED (Issue 10). When it hits 0 the
// demand transitions to MATCHED. This file holds the pure transitions; the
// offer-driven decrements live in the offer routes (#10) since they depend on
// the offer lifecycle, not the demand one.

// --- Initial pending_quantity on create -------------------------------------

/// A freshly created demand has nothing matched yet, so pending_quantity
/// equals the requested quantity. The API uses this when inserting so the
/// invariant "pending_quantity initializes to quantity" (Issue 07 acceptance)
/// is enforced in one place, not copy-pasted at every call site.
export function initialPendingQuantity(quantity: number): number {
  return quantity;
}

// --- Can the buyer still edit this demand? ----------------------------------

/// Only an OPEN demand may be edited by its buyer (update fields or cancel).
/// Once MATCHED/COMPLETED/EXPIRED/CANCELLED the demand is locked. The buyer
/// owner gate (getCurrentUser id === demand.buyer_id) is checked separately in
/// the route handler; this only answers the state-machine half.
export function canEditDemand(status: DemandStatus): boolean {
  return status === DemandStatus.Open;
}

// --- Does this demand still accept new offers? ------------------------------

/// Only an OPEN demand accepts new offers. MATCHED is fully covered, and
/// CANCELLED/COMPLETED/EXPIRED are closed — Issue 08's "cancelled demands stop
/// accepting offers" rule + Issue 10's offer-create gate both reduce to this.
/// Offer writes are seller-side (#10); this is the demand half of the gate.
export function acceptsOffers(status: DemandStatus): boolean {
  return status === DemandStatus.Open;
}

// --- Is the new deadline a real extension? ----------------------------------

/// PATCH /api/demands/:id refuses a new deadline that isn't strictly later
/// than the current one — otherwise the buyer could "extend" by shortening
/// (or no-op). Equality is also refused. Malformed timestamps parse to NaN,
/// which compares false against any number, so a bad value refuses safely.
export function isDeadlineExtension(
  currentDeadline: string,
  newDeadline: string
): boolean {
  const current = Date.parse(currentDeadline);
  const next = Date.parse(newDeadline);
  if (Number.isNaN(current) || Number.isNaN(next)) return false;
  return next > current;
}
