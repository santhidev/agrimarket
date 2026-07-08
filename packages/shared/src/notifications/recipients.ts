// Recipient computation for notification fan-out (Issue 17).
//
// demandCreatedRecipients is the only fan-out: every other event type has a
// single recipient (the demand's buyer_id or one seller_id) that the route
// already knows. Pure — the route queries `follows` and passes the rows in,
// so this is unit-testable without a DB mock.

export function demandCreatedRecipients(
  demand: { productId: string; buyerId: string },
  follows: { userId: string; productId: string }[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of follows) {
    if (f.productId !== demand.productId) continue;
    if (f.userId === demand.buyerId) continue; // don't notify the actor
    if (seen.has(f.userId)) continue;
    seen.add(f.userId);
    out.push(f.userId);
  }
  return out;
}
