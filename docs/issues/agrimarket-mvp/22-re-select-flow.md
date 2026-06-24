Status: ready-for-agent

## What to build

When sellers decline (or auto-decline after 24h), buyer can re-select new offers. Previously CONFIRMED offers → ACTIVE (must re-select + re-confirm). Buyer selects new offers → PENDING_SELLER_CONFIRMATION. Full re-selection cycle supported. UI shows which sellers declined + allows selecting new offers.

## Acceptance criteria

- [ ] Buyer can POST /demands/:id/select again after sellers decline
- [ ] Previously CONFIRMED offers → ACTIVE when buyer re-selects
- [ ] DECLINED offers stay DECLINED (not re-selectable)
- [ ] New selections → PENDING_SELLER_CONFIRMATION (full cycle repeats)
- [ ] pending_quantity recalculated
- [ ] UI: "Sellers declined" notification with list
- [ ] UI: re-select screen showing available ACTIVE offers (excluding DECLINED)
- [ ] UI: previously confirmed sellers marked "needs re-confirmation"
- [ ] Unit tests: re-select after decline, CONFIRMED→ACTIVE, DECLINED excluded, pending_quantity recalc

## Blocked by

20