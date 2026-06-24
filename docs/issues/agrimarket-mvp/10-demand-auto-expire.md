Status: ready-for-agent

## What to build

Hangfire background job that checks Demand deadline every 5 minutes. When deadline passes and Demand is still OPEN (no match), auto-transition to EXPIRED. All ACTIVE offers → EXPIRED. PENDING_SELLER_CONFIRMATION and CONFIRMED offers → CANCELLED.

## Acceptance criteria

- [ ] Hangfire job runs every 5 minutes checking OPEN demands
- [ ] Demand past deadline → EXPIRED
- [ ] ACTIVE offers on expired demand → EXPIRED
- [ ] PENDING_SELLER_CONFIRMATION and CONFIRMED offers → CANCELLED
- [ ] Buyer notified via SignalR (DemandHub.StatusChanged)
- [ ] Unit tests: expire on deadline, no expire before deadline, offer cascade
- [ ] Integration test: Hangfire job execution with test data

## Blocked by

08