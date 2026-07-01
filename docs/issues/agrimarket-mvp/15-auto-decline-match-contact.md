Status: ready-for-agent

## What to build

Auto-decline (BullMQ): a PENDING_SELLER_CONFIRMATION offer older than 24h → DECLINED. Match + contact: once all selected offers are CONFIRMED, the buyer confirms self-pickup via `POST /api/demands/:id/match` → Demand MATCHED + offers MATCHED; the system then exposes the matched sellers' phone numbers to the buyer (contact info endpoint `GET /api/demands/:id/contacts`).

## Acceptance criteria

- [ ] PENDING offer older than 24h → DECLINED by the BullMQ job (idempotent)
- [ ] Buyer can match when all selected offers are CONFIRMED
- [ ] Match sets Demand → MATCHED, selected offers → MATCHED
- [ ] `GET /api/demands/:id/contacts` returns matched sellers' phone numbers (buyer only)
- [ ] Matched demand feeds the auto-complete job from 09 (7-day → COMPLETED)
- [ ] Vitest: 24h auto-decline; match precondition (all CONFIRMED); contacts gate (buyer only)

## Blocked by

14
