Status: ready-for-agent

## What to build

Hangfire background job that auto-completes MATCHED demands after 7 days. Demand MATCHED → COMPLETED (if no complaint/issue). Cleans up stale demands. SignalR notification to buyer + sellers.

## Acceptance criteria

- [ ] Hangfire job checks MATCHED demands daily
- [ ] Demand MATCHED > 7 days → COMPLETED
- [ ] SignalR: DemandHub.StatusChanged → buyer + sellers (+ FCM Push)
- [ ] Unit tests: auto-complete after 7 days, no complete before 7 days
- [ ] Integration test: Hangfire job execution

## Blocked by

21