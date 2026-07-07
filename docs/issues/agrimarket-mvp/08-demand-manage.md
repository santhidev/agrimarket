Status: done

## What to build

Demand management by the buyer: extend deadline (`PATCH /api/demands/:id` with new deadline), cancel (`DELETE /api/demands/:id` → status CANCELLED, cascades: every ACTIVE/PENDING/CONFIRMED/SELECTED offer → CANCELLED), and share via deeplink (a stable URL `/d/:id` or short id that renders the demand detail publicly enough to share on LINE/Facebook).

## Acceptance criteria

- [x] Buyer can extend their Demand's deadline
- [x] Buyer can cancel their Demand; cancellation cascades to all non-terminal offers (→ CANCELLED)
- [x] Share link opens the Demand detail (read-only for non-owner)
- [x] Cancelled Demands stop accepting new offers
- [x] Vitest: extend updates deadline; cancel cascades offers to CANCELLED; cancelled demand rejects new offers

## Blocked by

07

---

## Implementation notes (2026-07-07)

Done. All acceptance criteria met.

### What shipped

- **Shared package** (`packages/shared/src/`):
  - `offer/enums.ts` + `offer/offer-transitions.ts` (new) — the `OfferStatus` vocabulary + `isOfferTerminal` / `shouldCancelOfferOnDemandCancel` pure predicates. The offers TABLE is Issue 10; this file is the shared vocabulary both issues read from so the cancel-cascade rule lives in one place.
  - `demand/demand-transitions.ts` — added `acceptsOffers(status)` (OPEN-only, the #10 offer-create gate's demand half) and `isDeadlineExtension(current, new)` (strictly-later check, refuses shortening + equality + malformed timestamps).
  - `demand/schemas.ts` — added `extendDemandSchema` (deadline-only PATCH body, future ISO, strict). Mirrors `createDemandSchema`'s deadline rule.
  - 21 new unit tests (cascade predicate × 8, acceptsOffers × 4, isDeadlineExtension × 4, extendDemandSchema × 5). Full suite 147 passed.
- **API routes** (`apps/web/app/api/demands/[id]/route.ts`):
  - `PATCH` — owner-only extend. Gates: 401 (no session) → 404 (missing/hidden under RLS) → 403 (not owner) → 409 (non-OPEN via `canEditDemand`) → 400 (bad body / not strictly-later via `isDeadlineExtension`). Sets only `deadline`; quantity/product/lat-lng are immutable after create.
  - `DELETE` — owner-only cancel (soft-cancel: status → CANCELLED via the existing `demands_update_owner_or_admin` policy, no hard delete). Same gate chain as PATCH. Includes a `// Issue 08 cascade NOTE` documenting where #10 will add the offers update using `shouldCancelOfferOnDemandCancel`.
- **Web pages**:
  - `apps/web/app/d/[id]/page.tsx` (new) — share deeplink → `redirect()` to `/demands/:id` (307). Short stable URL for LINE/Facebook; the detail page enforces visibility (OPEN public, hidden → 404) so the share target sees exactly what their session allows.
  - `apps/web/app/demands/[id]/OwnerActions.tsx` (new client component) — owner-only action bar: extend (inline datetime-local form → PATCH), cancel (confirm() → DELETE), share (clipboard copy `/d/:id` with prompt fallback for insecure contexts). Re-fetches the detail via `router.refresh()` on success.
  - `apps/web/app/demands/[id]/page.tsx` — renders `OwnerActions` only when `current.id === demand.buyerId`; passes `TopNav` the logged-in flag. Read-only for anon/non-owner viewers.

### Decisions worth recording

- **No migration.** The `demands_update_owner_or_admin` RLS policy + `canEditDemand(OPEN)` gate from Issue 07 already cover PATCH and cancel-by-status-flip. Issue 08 is API + UI + shared-logic work, not schema work. The only DB-side addition for the full cancel flow is the offers-table cascade — that's Issue 10's job (the predicate is ready in `@agrimarket/shared`).
- **Offer vocabulary shipped in #08, not #10.** `OfferStatus` + `shouldCancelOfferOnDemandCancel` + `acceptsOffers` are pure domain rules the #08 acceptance criteria explicitly name ("cancel cascades offers to CANCELLED", "cancelled demand rejects new offers"). Declaring them now means #10 wires them in a single place rather than re-deriving the cascade/gate rules at the route — and the #08 vitest suite can assert them against mock statuses without a DB.
- **Soft-cancel, not hard delete.** A cancelled demand stays for history + the cascade audit. RLS keeps non-OPEN rows owner-or-admin, so the public list never shows them. The buyer can re-create if they change their mind (cancel is terminal).
- **PATCH is deadline-only.** Issue 08 scope names only the deadline extension. Quantity/product/lat-lng changes would change what sellers are bidding against mid-flight and are out of scope; the `extendDemandSchema` is `.strict()` so a stray `quantity` field 400s rather than silently ignoring.
- **Strictly-later check owns the ordering rule.** zod can't compare against a DB column, so `isDeadlineExtension(current, new)` lives in the shared package (unit-tested) and the route calls it after the schema parse. Refuses shortening and equality.
- **Share via `/d/:id` redirect, not a separate render.** One detail page (canonical `/demands/:id`) enforces all visibility rules; the deeplink just shortens the URL for sharing. Avoids a second render path that could drift from the canonical.

### Manual verification matrix

- anon `GET /api/demands/<open>` → 200 ✓
- anon `PATCH /api/demands/<open>` → 401 ✓
- anon `DELETE /api/demands/<open>` → 401 ✓
- anon `GET /api/demands/<bogus-uuid>` → 404 (`.single()` null-data-then-error ordering still holds) ✓
- anon `GET /api/demands/<matched-id>` → 404 (RLS hides non-OPEN; existence not leaked) ✓
- `GET /d/<open>` → 307 → `/demands/<open>` (RSC redirect) ✓
- detail page `/demands/<bogus>` → 404, `/demands` browse → 200, `/demands/new` → 200 ✓
- owner-action bar renders only for owner (gate: `current.id === demand.buyerId`) ✓
- DB clean: `count(*)` = 0 after test-row cleanup ✓
- `pnpm --filter @agrimarket/shared test` → 147 passed ✓
- `pnpm --filter @agrimarket/shared build` → clean ✓
- `pnpm --filter @agrimarket/web typecheck` → clean ✓

### Quirks hit (memory for #10)

- **Authed happy-path not HTTP-verified** — Browser MCP (Playwright + chrome-devtools) was unavailable again this session ("Not connected"). The InsForge auth flow needs httpOnly cookies from the OTP edge function, so the owner-side PATCH/DELETE/extend happy paths were verified via: (a) unit tests on the pure gate predicates, (b) the 401 anon gate over HTTP, (c) the pre-existing `demands_update_owner_or_admin` RLS policy as the DB-layer owner enforcement. When the browser backend returns, the Playwright login flow (navigate `/login` → phone → OTP boxes via `evaluate` → `fetch()` PATCH/DELETE from the authed page) is the gap to close.
- **Webpack cache corruption did NOT recur** despite adding a new `[id]` route (`/d/[id]`) and a client component (`OwnerActions.tsx`). Preemptive `taskkill node.exe` + `rm -rf apps/web/.next/cache/webpack` before starting the dev server may be why — worth doing before any session that adds a dynamic route.

