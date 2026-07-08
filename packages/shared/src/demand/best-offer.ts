// Best Offer: Bounded Knapsack (Issue 13).
//
// Given a demand's target quantity + a list of ACTIVE offers (each with
// quantity, price, pickup lat/lng), compute ranked offer combinations: the
// cheapest way(s) to fulfill the demand, with total distance (Haversine,
// weighted by quantity) as the tiebreaker on equal total cost. Whole-offer
// selection (0/1) with overflow trimmed from the most-expensive offer in the
// chosen subset so the combination lands exactly on the target quantity.
// Partial-fulfillment combinations are included only when total supply is
// below the target — otherwise only full combinations are ranked.
//
// Pure: no I/O, no rounding beyond IEEE-754. The route filters ACTIVE offers
// and maps DB offer rows to BestOfferInputOffer before calling; this module never
// touches offer status or the DB. See CONTEXT.md "Best Offer" + "Business
// Rules" (sum(quantity) > 0 และ ≤ demand.quantity).

import { haversineKm } from "./haversine-km";

// --- Types -------------------------------------------------------------------

/// A single offer as the solver sees it. The route maps the DB offer row
/// (camelCased) into this shape — only the fields the solver needs.
export type BestOfferInputOffer = {
  id: string;
  pricePerUnit: number;
  quantity: number; // int > 0
  pickupLat: number;
  pickupLng: number;
};

export type BestOfferInput = {
  targetQuantity: number; // demand.quantity, int > 0
  buyerLat: number;
  buyerLng: number;
  offers: BestOfferInputOffer[];
};

/// One offer within a combination, after any overflow trim. `quantity` is ≤
/// the original offer's quantity (trimmed if this offer was the most-expensive
/// in a subset that exceeded the target). Mirrors the `accepted_quantity`
/// semantics that #14 will persist when the buyer actually selects.
export type BestOfferLine = {
  offerId: string;
  quantity: number;
  pricePerUnit: number;
  lineTotal: number; // pricePerUnit * quantity
};

export type BestOfferCombination = {
  offers: BestOfferLine[];
  totalQuantity: number; // ≤ targetQuantity
  totalCost: number; // Σ lineTotal
  totalDistanceKm: number; // Σ haversineKm(buyer, pickup) * quantity
  isPartial: boolean; // totalQuantity < targetQuantity
};

export type BestOfferResult = {
  combinations: BestOfferCombination[]; // top 5, cost asc → distance asc
  canFulfill: boolean; // ≥1 full-Q combination exists
};

// --- Solver ------------------------------------------------------------------

/// Compute ranked offer combinations for a demand. Empty offers → no
/// combinations, canFulfill=false. Otherwise enumerates whole-offer subsets,
/// trims overflow from the most-expensive offer in each full subset, and
/// returns up to 5 combinations sorted by total cost then total distance.
///
/// Algorithm: enumerate every non-empty subset of offers (2^n − 1). For each:
///   - if Σ quantity ≥ targetQuantity → a "full" combination; trim the excess
///     from the most-expensive offer in the subset so the total lands exactly
///     on the target (CONTEXT.md: sum(quantity) ≤ demand.quantity);
///   - else → a "partial" combination, only surfaced when total supply across
///     ALL offers is below the target (the buyer is choosing the best partial
///     shortfall because no combination can fulfill the demand).
///
/// Ranking: full combinations first, then partials, each group sorted by
/// total cost ascending then total distance ascending (Haversine, weighted by
/// quantity). Capped at 5 — the buyer-facing view shows a short ranked list.
export function computeBestOffers(input: BestOfferInput): BestOfferResult {
  if (input.offers.length === 0) {
    return { combinations: [], canFulfill: false };
  }

  const { targetQuantity: Q, buyerLat, buyerLng, offers } = input;

  // Precompute each offer's distance once (re-used across every subset that
  // includes it). Weighted by quantity when summed into a combination.
  const perOffer = offers.map((o) => ({
    ...o,
    distance: haversineKm(buyerLat, buyerLng, o.pickupLat, o.pickupLng),
  }));

  // Total supply across all offers — decides whether partials surface.
  const totalSupply = perOffer.reduce((s, o) => s + o.quantity, 0);

  const full: BestOfferCombination[] = [];
  const partial: BestOfferCombination[] = [];

  const n = perOffer.length;
  // Enumerate every non-empty subset via bitmask. n is bounded by the route's
  // 20-offer guard, so 2^20 = ~1M subsets worst case — acceptable for the MVP.
  for (let mask = 1; mask < 1 << n; mask++) {
    const selected = perOffer.filter((_, i) => mask & (1 << i));
    const rawQty = selected.reduce((s, o) => s + o.quantity, 0);
    if (rawQty === 0) continue;

    if (rawQty >= Q) {
      // Full combination — trim overflow from the most-expensive offer in the
      // subset so the total lands exactly on Q.
      full.push(buildCombination(selected, Q, false));
    } else {
      // Partial: no trim — use every unit offered. The caller decides whether
      // partials surface (only when total supply < Q).
      partial.push(buildCombination(selected, rawQty, true));
    }
  }

  // Rank: full first (cost asc → distance asc), then partial by the same key.
  // Dedupe first: trimming can collapse a multi-offer subset to the same line
  // set as a smaller subset (e.g. {cheap, pricey} with pricey trimmed to 0 ==
  // {cheap} alone). Keep only the first (= cheapest-ranked) of each signature.
  const rankKey = (c: BestOfferCombination) => c.totalCost * 1e9 + c.totalDistanceKm;
  full.sort((a, b) => rankKey(a) - rankKey(b));
  partial.sort((a, b) => rankKey(a) - rankKey(b));
  const dedupedFull = dedupeBySignature(full);
  const dedupedPartial = dedupeBySignature(partial);

  const canFulfill = dedupedFull.length > 0;
  const combinations = pickRanked(dedupedFull, dedupedPartial, totalSupply < Q, 5);

  return { combinations, canFulfill };
}

// A combination's signature is the multiset of (offerId, quantity) lines,
// ignoring zero-quantity lines (offers trimmed entirely away). Two
// combinations with the same signature are the same deal — keep only one.
// Caller sorts before deduping so the cheapest-ranked copy wins.
function dedupeBySignature(combos: BestOfferCombination[]): BestOfferCombination[] {
  const seen = new Set<string>();
  const out: BestOfferCombination[] = [];
  for (const c of combos) {
    const sig = c.offers
      .filter((l) => l.quantity > 0)
      .map((l) => `${l.offerId}:${l.quantity}`)
      .sort()
      .join("|");
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(c);
  }
  return out;
}

// Build a combination from a subset of offers, using up to `qtyToUse` units
// total. When the subset's raw total exceeds `qtyToUse` (a full combination
// with overflow), the excess is trimmed from the MOST-EXPENSIVE offers first
// — the buyer keeps the cheap units, sheds the pricey ones (CONTEXT.md
// intent). The remaining units are then consumed cheapest-first so the
// output line order is stable and readable.
//
// `isPartial` is decided by the caller (rawQty < targetQuantity), not derived
// here: a trimmed full combination reaches the target, so it is NOT partial
// even though qtyToUse < rawQty.
function buildCombination(
  selected: { id: string; pricePerUnit: number; quantity: number; distance: number }[],
  qtyToUse: number,
  isPartial: boolean
): BestOfferCombination {
  const rawQty = selected.reduce((s, o) => s + o.quantity, 0);
  const excess = Math.max(0, rawQty - qtyToUse);

  // Effective quantity per offer after trimming the excess from the
  // most-expensive offers first. Work in price-descending order.
  const byPriceDesc = [...selected].sort((a, b) => b.pricePerUnit - a.pricePerUnit);
  let toTrim = excess;
  const effectiveQty = new Map<string, number>();
  for (const o of byPriceDesc) {
    const trim = Math.min(o.quantity, toTrim);
    effectiveQty.set(o.id, o.quantity - trim);
    toTrim -= trim;
    if (toTrim <= 0) {
      // Keep remaining offers at full quantity.
      for (const rest of byPriceDesc) {
        if (!effectiveQty.has(rest.id)) effectiveQty.set(rest.id, rest.quantity);
      }
      break;
    }
  }

  // Consume cheapest-first to build the output lines (stable order).
  const byPriceAsc = [...selected].sort((a, b) => a.pricePerUnit - b.pricePerUnit);
  const lines: BestOfferLine[] = [];
  let totalCost = 0;
  let totalDistanceKm = 0;
  let remaining = qtyToUse;

  for (const o of byPriceAsc) {
    const take = Math.min(effectiveQty.get(o.id) ?? 0, remaining);
    if (take <= 0) continue;
    const lineTotal = o.pricePerUnit * take;
    lines.push({
      offerId: o.id,
      quantity: take,
      pricePerUnit: o.pricePerUnit,
      lineTotal,
    });
    totalCost += lineTotal;
    // Weighted by quantity: an offer that's far away but supplies a lot
    // contributes more to the trip-cost proxy than a nearby small one.
    totalDistanceKm += o.distance * take;
    remaining -= take;
  }

  return {
    offers: lines,
    totalQuantity: qtyToUse,
    totalCost,
    totalDistanceKm,
    isPartial,
  };
}

// Choose the final ranked list: full combinations fill first; partials are
// appended only when (a) there's room left under the cap AND (b) total supply
// is below the target (the buyer is choosing the best available shortfall).
function pickRanked(
  full: BestOfferCombination[],
  partial: BestOfferCombination[],
  includePartials: boolean,
  cap: number
): BestOfferCombination[] {
  const out = full.slice(0, cap);
  if (includePartials) {
    for (const p of partial) {
      if (out.length >= cap) break;
      out.push(p);
    }
  }
  return out;
}
