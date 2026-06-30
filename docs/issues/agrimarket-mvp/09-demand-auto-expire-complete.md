Status: ready-for-agent

## What to build

Demand lifecycle background jobs via BullMQ (Redis-backed, from docker-compose). Auto-expire: a recurring job (every 5 min) finds OPEN Demands whose deadline passed → EXPIRED. Auto-complete: a scheduled job finds MATCHED Demands older than 7 days → COMPLETED. Both update status + notify the buyer.

## Acceptance criteria

- [ ] BullMQ worker bootstraps with the app (Redis connection)
- [ ] OPEN demand past deadline → EXPIRED by the recurring job
- [ ] MATCHED demand older than 7 days → COMPLETED by the scheduled job
- [ ] Both transitions emit a notification event (consumed by 17 when ready; for now log/seed a `notifications` row)
- [ ] Vitest: job logic (expire picks correct demands; complete picks correct demands; idempotent on re-run)

## Blocked by

07
