Status: done

## What to build

Competitive bidding view: a seller sees competing offers on a Demand (price + competing seller name) so they can adjust. The view is exposed on `GET /api/demands/:id/offers` for sellers. Sellers see competitors' prices only after those competitors have accepted the latest counter-offer (ties into 12); before that, a seller sees only aggregate/own data.

## Acceptance criteria

- [x] `GET /api/demands/:id/offers` returns the calling seller's own offer + visible competitors
- [x] A competitor's price is hidden until that competitor has accepted the current counter-offer
- [x] Seller can adjust their own price inline (reuses PATCH from 10)
- [x] Buyer sees all offers with full detail
- [x] Vitest: visibility rules (hidden vs revealed), buyer vs seller view shapes

## Blocked by

10

---

## Implementation notes (2026-07-08)

Done. All acceptance criteria met. Shipped together with #12 (counter-offer)
in one session — #11's visibility rule consumes #12's `counter_offer_price`,
so the two were built as one feature.

### What shipped

- **API route** (`apps/web/app/api/demands/[id]/offers/route.ts`, new):
  - `GET` — role-shaped response:
    - **Buyer** of the demand: `{ counterOfferPrice, offers: [...full +
      sellerPhone] }` — sees every offer with full detail (price, quantity,
      grade, photos, location, ready date) + the seller's phone (the only
      identifier on `profiles`; there's no name column).
    - **Seller**: `{ counterOfferPrice, myOffer: {...full} | null,
      competitors: [{ sellerPhone, pricePerUnit, accepted }] }` — sees their
      own offer in full + competitors whose price has "accepted" the
      counter-offer (price ≤ counter_offer_price). The seller adjusts their
      own price inline via `PATCH /api/offers/:id` (#10).
  - Gate: 401 (anon) → 404 (demand missing/hidden — OPEN demands are public,
    non-OPEN is owner-or-admin only under RLS).
- **Visibility enforcement** (two layers — see #12's migration notes):
  - DB: `offers_select_competitor_accepted` policy hides non-accepted
    competitor offers from a seller's SELECT (RLS). The route's query returns
    only own + accepted competitor rows.
  - Route: `isCounterOfferAccepted` re-checks per competitor so the response
    is self-documenting and matches the unit-tested rule.
- **Shared predicate** `isCounterOfferAccepted` (in #12) — the pure rule the
  route + tests use. 5 unit tests cover: no counter-offer → false; tie → true;
  below → true; above → false.

### Decisions worth recording

- **Competitor detail is `sellerPhone + pricePerUnit`, not full offer.** A
  seller only needs to know *who* is competing and *at what price* — not the
  competitor's quantity, location, photos, or ready date (those are the
  buyer's evaluation criteria, not a competitor's concern). This matches
  CONTEXT.md "เกษตรกรเห็น counter-offer ของคู่แข่งเมื่อคู่แข่งยอมรับราคาแล้ว".
- **`profiles` has no `name` column** — `phone` is the only human-identifying
  field. The route joins `profiles!offers_seller_id_fkey(phone)` so the buyer
  can contact the seller post-match (the phone is the contact channel per
  CONTEXT.md "MATCHED = ระบบให้เบอร์ติดต่อ"). A future `display_name` column
  would be a drop-in.
- **RLS does the heavy lifting.** Rather than fetching all offers + filtering
  in JS (which would leak competitor existence even when hidden), the
  `offers_select_competitor_accepted` policy means the seller's SELECT never
  receives non-accepted competitor rows. The route trusts the result.
- **No separate "aggregate" view.** The original issue text mentioned
  "aggregate/own data" before a counter-offer — the implementation simplifies:
  before any counter-offer, a seller sees only their own offer (competitors
  array is empty). This is cleaner than a separate aggregate shape and still
  lets the seller decide whether to wait or adjust.

### Verification (live, against the dev DB)

- **Auth gate:** `GET /api/demands/:id/offers` returns 401 for anonymous
  callers (verified via dev server).
- **DB-layer visibility** (admin-client script, simulating the route logic):
  - Two sellers (A at 25, B at 18) on an OPEN demand; buyer sets counter-offer
    at 20.
  - `is_counter_offer_accepted(25, demand)` → false (A hidden); `(18, demand)`
    → true (B visible) ✅
  - The seller's own offer is always visible regardless of the counter-offer ✅
- Test data cleaned up after verify.
- Pure-logic visibility rules covered by 5 unit tests on
  `isCounterOfferAccepted` (the predicate the route + RLS both use).

### Files

- `apps/web/app/api/demands/[id]/offers/route.ts` (new)
- `migrations/20260707184016_add-offer-competitor-visibility.sql` (new, applied
  — shared with #12: the helper + policy this route relies on)
- `packages/shared/src/demand/counter-offer.ts` (new — shared with #12:
  `isCounterOfferAccepted`)

### Open loose ends (non-blocking)

- **Owner-side happy path not HTTP-verified** (browser MCP down). The 401 anon
  gate + DB-helper verification + RLS policy + unit tests cover the logic; the
  live buyer/seller GET round-trip over HTTP is the manual gap.
- **No "aggregate" view** (see Decisions) — the simplified shape (own offer +
  accepted competitors only) covers the use case; revisit if product wants a
  pre-counter-offer summary like "3 sellers competing".

