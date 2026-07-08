// Buyer select quantity validation (Issue 14).
//
// When the buyer selects a combination of offers (POST /api/demands/:id/select),
// the chosen accepted quantities must satisfy CONTEXT.md's "Confirm (select):
// sum(quantity) > 0 และ ≤ demand.quantity" plus per-offer and uniqueness rules.
// This predicate is pure: the route supplies the offer rows (their offered
// quantities) + the demand's target quantity; this answers "is the selection
// valid". Mirrors the constraint the DB CHECK (`accepted_quantity >= 0`) only
// partially encodes — the sum + per-offer + uniqueness rules live here.

/// A selection item as the predicate sees it: the offer id, the buyer's chosen
/// accepted quantity, and the offer's offered quantity (to enforce
/// accepted ≤ offered). The route maps its validated body + the loaded offer
/// rows into this shape before calling.
export type SelectionItem = {
  offerId: string;
  acceptedQuantity: number;
  offerQuantity: number;
};

/// True when the selection is valid against a demand's target quantity:
///   - non-empty;
///   - every acceptedQuantity is a positive integer;
///   - every acceptedQuantity ≤ its offer's offered quantity;
///   - no duplicate offerIds;
///   - total acceptedQuantity > 0 and ≤ demandQuantity.
///
/// The DB layer already CHECKs `accepted_quantity >= 0` and the offers
/// unique index guards (demand_id, seller_id); this encodes the demand-side
/// sum constraint + the per-offer cap + de-duplication that the DB can't
/// express in a single row-level check.
export function isValidSelectionQuantities(
  demandQuantity: number,
  items: SelectionItem[]
): boolean {
  if (items.length === 0) return false;

  const seen = new Set<string>();
  let total = 0;

  for (const it of items) {
    if (!Number.isInteger(it.acceptedQuantity) || it.acceptedQuantity <= 0) {
      return false;
    }
    if (it.acceptedQuantity > it.offerQuantity) {
      return false;
    }
    if (seen.has(it.offerId)) {
      return false;
    }
    seen.add(it.offerId);
    total += it.acceptedQuantity;
  }

  return total > 0 && total <= demandQuantity;
}
