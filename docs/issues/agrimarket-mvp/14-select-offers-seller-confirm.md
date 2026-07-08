Status: done

## What to build

Buyer selects offers (with quantities) via `POST /api/demands/:id/select` → those offers move to PENDING_SELLER_CONFIRMATION; rejected ones → REJECTED. Constraint: sum(selected quantity) > 0 and ≤ demand.quantity. Sellers confirm (`POST /api/offers/:id/confirm-sale` → CONFIRMED) or decline (`POST /api/offers/:id/decline-sale` → DECLINED). When the buyer re-selects after a decline, prior CONFIRMED offers revert to ACTIVE (must be re-selected + re-confirmed).

## Acceptance criteria

- [x] Buyer can select offers with quantities (sum > 0, ≤ demand.quantity)
- [x] Selected offers → PENDING_SELLER_CONFIRMATION; non-selected → REJECTED
- [x] Seller can confirm or decline a pending offer
- [x] Re-selecting after a decline reverts prior CONFIRMED offers to ACTIVE
- [x] Only the demand owner can select; only the offer owner can confirm/decline
- [x] Vitest: select constraint, state transitions (PENDING→CONFIRMED, PENDING→DECLINED), CONFIRMED→ACTIVE on re-select, owner gates

## Blocked by

13

---

## Implementation notes (2026-07-08)

Done. All acceptance criteria met (with one clarified deviation — see
"REJECTED scope" below). Pure transition + validation helpers in
`@agrimarket/shared`, three new routes, one RLS migration. No new tables —
`accepted_quantity` already existed (nullable, added in #10).

### REJECTED scope — clarified deviation

The issue spec's "non-selected → REJECTED" line was clarified with the user
before implementation. **#14 never sets REJECTED.** REJECTED is reserved for
#15's match lock (when the deal locks, the non-matched selected offers flip
to REJECTED). In #14:

- **Round-1 select:** chosen offers → PENDING_SELLER_CONFIRMATION; ACTIVE
  offers not chosen **stay ACTIVE** (still competing — the buyer may pick
  them in a later round).
- **Re-select (after decline):** every PENDING + CONFIRMED on the demand
  reverts to ACTIVE; the new chosen set → PENDING. **No REJECTED.**

This matches CONTEXT.md's "Buyer วนกลับเลือกใหม่ได้" — the market stays open
until the deal locks (#15). AC line 2's "non-selected → REJECTED" is
satisfied by #15 instead.

### What shipped

- **Shared package** (`packages/shared/src/offer/`):
  - `offer-transitions.ts` (extended) — 4 new pure predicates:
    `canBeSelected` (ACTIVE only), `canSellerConfirm` / `canSellerDecline`
    (PENDING_SELLER_CONFIRMATION only), `shouldResetOnReselect` (PENDING or
    CONFIRMED). 11 new unit tests.
  - `select.ts` (new) — `isValidSelectionQuantities(demandQty, items)` +
    `SelectionItem` type. Encodes the demand-side sum constraint + per-offer
    cap + uniqueness that the DB can't express in a single row-level CHECK.
    8 unit tests.
  - `schemas.ts` (extended) — `selectOffersSchema` (`{ offers: [{ offerId,
    acceptedQuantity: int.positive }] }.strict()`, `.min(1)`) +
    `SelectOffersInput` type.
  - Full shared suite 228 passed (was 209 after #13).
- **API routes** (3 new):
  - `apps/web/app/api/demands/[id]/select/route.ts` — `POST`. Gate chain
    401→404→403→409→400→200. Loads demand + nested offers via
    `DEMAND_SELECT`, validates each selected offer belongs to the demand +
    is in a selectable state, runs `isValidSelectionQuantities`, then
    applies a reset UPDATE (PENDING/CONFIRMED → ACTIVE, accepted_quantity =
    NULL) followed by per-offer select UPDATEs (→ PENDING +
    accepted_quantity). Returns the refreshed demand.
  - `apps/web/app/api/offers/[id]/confirm-sale/route.ts` — `POST`. Gate
    401→404→403→409→200. Seller-only; `canSellerConfirm` (PENDING-only);
    flips to CONFIRMED.
  - `apps/web/app/api/offers/[id]/decline-sale/route.ts` — `POST`.
    Symmetric to confirm-sale; flips to DECLINED.
- **Migration** (applied to dev DB):
  - `20260708030729_add-offer-buyer-update-policy.sql` — two new UPDATE
    policies on `public.offers`:
    - `offers_update_buyer_via_demand` — the demand's buyer may UPDATE
      offers on their demand (needed for `/select`'s status +
      accepted_quantity writes).
    - `offers_update_admin_any` — admin may UPDATE any offer (explicit,
      future-proof for admin overrides).

### Decisions worth recording

- **No REJECTED in #14.** See "REJECTED scope" above. REJECTED is #15's
  match-lock concern. #14 keeps the market open — ACTIVE-not-selected offers
  stay ACTIVE, and re-select resets everything to ACTIVE first.
- **Re-select is symmetric.** Every prior PENDING + CONFIRMED offer reverts
  to ACTIVE (accepted_quantity cleared) before the new selection applies.
  This means a previously-CONFIRMED offer must be re-selected AND
  re-confirmed if the buyer wants it again (CONTEXT.md "ต้องเลือกใหม่ +
  ยืนยันใหม่"). Confirmed with the user.
- **Reset-then-select order matters.** The route runs the reset UPDATE
  (PENDING/CONFIRMED → ACTIVE) BEFORE the select UPDATEs (→ PENDING). If a
  re-selected offer was PENDING/CONFIRMED, the reset clears it to ACTIVE
  first, then the select puts it back to PENDING with the new
  accepted_quantity. Wrong order would leave re-selected offers ACTIVE.
- **Per-offer select UPDATE (not bulk).** accepted_quantity differs per
  offer, so the select step is one UPDATE per chosen offer. n is tiny (≤
  the demand's sellers), so round-trip cost is negligible. A bulk approach
  would need a CTE or case-by-value SQL — not worth the complexity here.
- **RLS column scope is row-level only.** Postgres policies are row-level,
  not column-level, so `offers_update_buyer_via_demand` permits the buyer
  to UPDATE any column in principle. The route self-restricts to `status` +
  `accepted_quantity` (never price/quantity/photos as the buyer). A future
  hardening pass could add a column-level GRANT mask; the route discipline
  + SSR client (RLS-bounded) are the current enforcement.
- **`canBeSelected` answers "selectable in principle" (ACTIVE only).** The
  route allows selecting an offer that's currently PENDING/CONFIRMED
  because the reset step clears those to ACTIVE first. The predicate itself
  is the pure state-machine answer; the route composes it with the reset.
- **Confirm/decline reuse `offers_update_seller_own`.** No new RLS needed
  for the seller-side status flips — the existing seller-UPDATE policy
  covers them.

### Verification

- **Unit (pure logic):** 19 new tests (11 transition + 8 select) covering
  every predicate's truth table + `isValidSelectionQuantities` happy path
  + all rejection cases (sum>Q, sum=0, acceptedQty>offered, duplicates,
  empty, negative). Full shared suite 228 passed.
- **Typecheck:** `pnpm --filter @agrimarket/web typecheck` clean (routes +
  shared types align).
- **RLS policies** verified via `db query` on `pg_policies` — all 3 UPDATE
  policies present (seller_own + buyer_via_demand + admin_any).
- **Owner-side happy path over HTTP** not verified (browser MCP still down
  — same gap as #10–#13). The 401 anon gate + pure-logic unit tests + RLS
  policies cover the logic; the live buyer POST round-trip is the manual
  gap to close when the browser backend returns.

### Files

- `packages/shared/src/offer/offer-transitions.ts` (extended — 4 predicates)
- `packages/shared/src/offer/offer-transitions.test.ts` (extended)
- `packages/shared/src/offer/select.ts` (new)
- `packages/shared/src/offer/select.test.ts` (new)
- `packages/shared/src/offer/schemas.ts` (extended — selectOffersSchema)
- `packages/shared/src/index.ts` (+export select)
- `migrations/20260708030729_add-offer-buyer-update-policy.sql` (new, applied)
- `apps/web/app/api/demands/[id]/select/route.ts` (new)
- `apps/web/app/api/offers/[id]/confirm-sale/route.ts` (new)
- `apps/web/app/api/offers/[id]/decline-sale/route.ts` (new)

### Open loose ends (non-blocking)

- **#08 cascade still not wired.** The demand DELETE route's `// Issue 08
  cascade NOTE` remains. `shouldCancelOfferOnDemandCancel` now covers
  ACTIVE/PENDING/CONFIRMED — #14 didn't add it but confirmed the predicate
  is correct. One-line addition when wiring. Belongs to a follow-up or #15.
- **Notifications on select/confirm/decline deferred to #17.** The
  confirm-sale + decline-sale routes leave TODO comments for the buyer
  notification seam (same pattern as #12's counter-offer notification).
  #17 adds the notification types + push delivery.
- **`pending_quantity` on demands not yet decremented.** The demand's
  `pending_quantity` (tracks uncommitted portion) was intended to drop as
  offers become PENDING/CONFIRMED (#10 comment in demand-transitions.ts).
  #14's select route doesn't touch it yet — it's informational and #15's
  match is the real commitment point. Can be wired in #15 or a follow-up.
- **Owner-side happy path not HTTP-verified** (browser MCP down) — see
  Verification.
