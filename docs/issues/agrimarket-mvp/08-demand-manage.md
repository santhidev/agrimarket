Status: ready-for-agent

## What to build

Demand management by the buyer: extend deadline (`PATCH /api/demands/:id` with new deadline), cancel (`DELETE /api/demands/:id` → status CANCELLED, cascades: every ACTIVE/PENDING/CONFIRMED/SELECTED offer → CANCELLED), and share via deeplink (a stable URL `/d/:id` or short id that renders the demand detail publicly enough to share on LINE/Facebook).

## Acceptance criteria

- [ ] Buyer can extend their Demand's deadline
- [ ] Buyer can cancel their Demand; cancellation cascades to all non-terminal offers (→ CANCELLED)
- [ ] Share link opens the Demand detail (read-only for non-owner)
- [ ] Cancelled Demands stop accepting new offers
- [ ] Vitest: extend updates deadline; cancel cascades offers to CANCELLED; cancelled demand rejects new offers

## Blocked by

07
