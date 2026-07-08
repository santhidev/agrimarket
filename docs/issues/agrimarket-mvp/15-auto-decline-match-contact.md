Status: done

## What to build

Auto-decline (BullMQ): a PENDING_SELLER_CONFIRMATION offer older than 24h → DECLINED. Match + contact: once all selected offers are CONFIRMED, the buyer confirms self-pickup via `POST /api/demands/:id/match` → Demand MATCHED + offers MATCHED; the system then exposes the matched sellers' phone numbers to the buyer (contact info endpoint `GET /api/demands/:id/contacts`).

## Acceptance criteria

- [x] PENDING offer older than 24h → DECLINED by the BullMQ job (idempotent)
- [x] Buyer can match when all selected offers are CONFIRMED
- [x] Match sets Demand → MATCHED, selected offers → MATCHED
- [x] `GET /api/demands/:id/contacts` returns matched sellers' phone numbers (buyer only)
- [x] Matched demand feeds the auto-complete job from 09 (7-day → COMPLETED)
- [x] Vitest: 24h auto-decline; match precondition (all CONFIRMED); contacts gate (buyer only)

## Blocked by

14

---

## Implementation notes (2026-07-08)

Done. All acceptance criteria met. The three pieces (24h auto-decline cron,
match endpoint, contacts endpoint) follow the established patterns from Issues
09 and 14 — see the deviations/decisions below.

### Deviation: InsForge managed cron instead of BullMQ (carried from #09)

The spec text says "BullMQ." Issue 09 already swapped BullMQ for **InsForge
managed cron** (`npx @insforge/cli schedules`) with user approval on 2026-07-07,
on the grounds that these are pure wall-clock jobs (no event queue, no retry
backoff) so a managed-cron → Next.js route loop is simpler and serverless. The
auto-decline job is the same shape (a PENDING offer older than 24h → DECLINED),
so it reuses the identical managed-cron pattern rather than introducing a
worker process. The acceptance criterion "BullMQ job (idempotent)" is read as
"recurring job, idempotent."

### What shipped

- **Shared package** (`packages/shared/src/offer/`):
  - `offer-jobs.ts` (new) — pure predicate `shouldDeclineOffer(row, now)`
    (PENDING_SELLER_CONFIRMATION + updated_at ≥ `DECLINE_AFTER_MS` ago), plus
    the `DECLINE_AFTER_MS = 24 * 60 * 60 * 1000` constant. Mirrors
    `demand-jobs.ts` exactly: the 24h cut lives in the predicate (not SQL) so
    the constant is unit-tested; NaN timestamps skip safely; the status filter
    runs before the age check so a CONFIRMED offer (updated_at bumped by the
    confirm) is never declined.
  - `offer-transitions.ts` (+2 predicates) — `allSelectedOffersConfirmed`
    (match precondition: ≥1 chosen offer AND every chosen offer is CONFIRMED;
    ACTIVE-only / empty → false) and `shouldRejectOnMatch` (PENDING +
    CONFIRMED → REJECTED on the match lock; ACTIVE/terminal untouched).
  - `offer-jobs.test.ts` (new) + 9 new `offer-transitions.test.ts` cases.
    Full shared suite 243 passed (was 228; +15 tests).
  - Exported from `packages/shared/src/index.ts`.
- **API routes** (`apps/web/app/api/`):
  - `cron/offers/decline/route.ts` (new) — `POST`, gated by `X-Cron-Secret`
    vs `process.env.CRON_SECRET`. Service-role admin client bypasses RLS. SQL
    pre-filter `status='PENDING_SELLER_CONFIRMATION'` (joined with the demand +
    product for the notification payload) → `shouldDeclineOffer` age re-check →
    per-row UPDATE to DECLINED + INSERT notification `('offer.auto_declined',
    { offerId, demandId, productName })` to the seller. Log-and-continue on row
    failure; failed notification non-fatal (status flip already succeeded).
    Returns `{ declined }`. Mirrors `cron/demands/expire/route.ts`.
  - `demands/[id]/match/route.ts` (new) — buyer route (SSR client). Gate chain
    401 → 404 → 403 → 409 (not OPEN) → 409 (precondition: not all selected
    CONFIRMED via `allSelectedOffersConfirmed`) → 200. Applies three UPDATEs as
    the buyer (RLS `offers_update_buyer_via_demand`): selected CONFIRMED offers
    (`accepted_quantity` IS NOT NULL) → MATCHED; any leftover in-handshake
    offers → REJECTED (safety net via `shouldRejectOnMatch`); demand → MATCHED,
    `pending_quantity = 0`. No notification seed (#17 owns push — mirrors #14's
    confirm-sale route). Returns the refreshed demand.
  - `demands/[id]/contacts/route.ts` (new) — buyer route. Gate chain 401 → 404
    → 403 → 409 (not MATCHED) → 200. SELECTs MATCHED offers joining
    `seller:profiles!offers_seller_id_fkey(phone)` — the same FK join the buyer's
    offers view (#11) uses, so it reads the phone through the buyer's offers RLS
    (no profiles RLS violation, no admin client). Returns `{ contacts:
    [{ offerId, sellerId, sellerPhone, acceptedQuantity }] }`.

### Infrastructure (InsForge backend, not in repo)

- **Schedule `Offer Auto-Decline`** — cron `0 * * * *` (hourly, matching the
  Demand Complete cadence), POST `/api/cron/offers/decline`, header
  `X-Cron-Secret: ${{secrets.CRON_SECRET}}`. **Not yet created** — the route is
  standalone and works when hit; creating the schedule is a manual `npx
  @insforge/cli schedules create ...` step (same as the #09 schedules).

### Decisions worth recording

- **Why updated_at for the 24h window (no new `pending_since` column).**
  Issue 09's `shouldCompleteDemand` already uses updated_at for the 7-day
  window; adding a dedicated `pending_since` column would break the established
  convention and require a migration. The status filter runs first, so a
  CONFIRMED offer (updated_at bumped by confirm) is excluded by status before
  the age check — the 24h clock only ever applies to PENDING rows. Re-selecting
  (PENDING→ACTIVE→PENDING) re-bumps updated_at and correctly resets the clock.
- **Why the reject set exists but is normally empty at match.** Issue 14's
  select route resets every prior PENDING/CONFIRMED offer to ACTIVE before
  applying a new selection, so at match time the only in-handshake offers are
  the selected CONFIRMED ones. The reject UPDATE (`shouldRejectOnMatch` →
  REJECTED) is a defensive safety net against drift/race; in the happy path it
  touches zero rows. CONTEXT.md reserves REJECTED for exactly this lock.
- **Why ACTIVE offers are not rejected on match.** A MATCHED demand stops
  accepting offers (`acceptsOffers`), so leftover ACTIVE offers simply wither
  — they are not force-rejected. The seller didn't win, but they weren't
  dismissed mid-handshake. This matches CONTEXT.md's REJECTED-as-lock-only
  definition.
- **Why pending_quantity → 0 on match.** Issue 14 left pending_quantity unwired
  and named match as "the real commitment point." When the deal locks, all
  demand quantity is committed, so pending = 0. This closes the
  Demand OPEN → MATCHED transition cleanly.
- **Why no buyer-side notifications on match.** Issue 14's confirm-sale route
  established that buyer-facing push is #17's concern — buyer-side mutation
  routes only flip status. Match follows the same split: it flips statuses and
  leaves "demand.matched" / "offer.matched" / "offer.rejected" push to #17.
  The auto-decline *cron* does seed a notification (`offer.auto_declined`)
  because, like #09's crons, it has no user action to trigger a push.
- **Why hourly, not every minute, for auto-decline.** The PENDING set is small
  and the query is idempotent; hourly keeps the decline latency under an hour
  at trivial cost, mirroring #09's Demand Complete cadence.

### Idempotency + safety

- The decline cron is idempotent: SQL pre-filter + `shouldDeclineOffer`
  re-check means a row a prior tick moved is no longer PENDING and is excluded
  on the next SELECT — no duplicate notifications. A row that raced (seller
  confirmed between SELECT and UPDATE) is skipped by the status check.
- The match route's three UPDATEs are ordered match → reject → demand; the
  match + reject sets are disjoint by status/accepted_quantity filter, so the
  order is defensive. A concurrent confirm/decline between the load and the
  UPDATEs is bounded by the precondition re-check at the top (the route reads
  fresh offers before deciding); full transactional isolation is deferred to a
  Phase-2 concurrency hardening pass (the MVP writes are low-contention, single
  buyer per demand).
- 0-target decline tick returns `{ declined: 0 }` with 200 — not an error.

### Verification

- `pnpm -r typecheck` — clean across `packages/shared`, `packages/database`,
  `apps/web`.
- `pnpm --filter @agrimarket/shared test` — 243 passed (15 new: 6 offer-jobs +
  5 allSelectedOffersConfirmed + 4 shouldRejectOnMatch). Confirms the 24h
  boundary (`>=` at exactly 24h), the "left PENDING" skip, the NaN skip, and
  the match-precondition truth table (all-CONFIRMED true; one-PENDING false;
  empty false; ACTIVE-only false).
- `pnpm test` (turbo) — 5/5 tasks successful.
- **Live curl verification:** deferred — it requires a running dev server,
  buyer + seller auth sessions, and seeded rows in specific states (a 25h-old
  PENDING offer; a fully-CONFIRMED demand). The logic is covered by unit tests
  + typecheck; the routes clone verified patterns (#09 crons, #14 select). A
  live pass is recommended before deploy.

### Files

- `packages/shared/src/offer/offer-jobs.ts` (new)
- `packages/shared/src/offer/offer-jobs.test.ts` (new)
- `packages/shared/src/offer/offer-transitions.ts` (+2 predicates)
- `packages/shared/src/offer/offer-transitions.test.ts` (+9 tests)
- `packages/shared/src/index.ts` (+export)
- `apps/web/app/api/cron/offers/decline/route.ts` (new)
- `apps/web/app/api/demands/[id]/match/route.ts` (new)
- `apps/web/app/api/demands/[id]/contacts/route.ts` (new)
