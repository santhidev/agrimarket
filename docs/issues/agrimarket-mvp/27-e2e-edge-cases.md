Status: ready-for-agent

## What to build

E2E edge case tests covering non-happy-path scenarios. Uses xUnit + WebApplicationFactory + SignalR test client.

## Acceptance criteria

- [ ] Counter-offer multiple rounds (buyer sends 3 times, sellers adjust each time)
- [ ] Seller decline → buyer re-select new seller → re-confirm
- [ ] Auto-expire: demand passes deadline → EXPIRED + offers cascade
- [ ] Auto-decline: seller doesn't respond in 24h → DECLINED
- [ ] Auto-complete: demand MATCHED → 7 days → COMPLETED
- [ ] Cancel demand: buyer cancels from OPEN → all offers CANCELLED
- [ ] Cancel demand: buyer cancels from MATCHED → all offers CANCELLED
- [ ] Unique offer constraint: same seller tries to submit 2 offers → rejected
- [ ] KYC gate: unapproved seller tries to submit offer → rejected
- [ ] Follow before KYC: user follows product before KYC → allowed
- [ ] Extend deadline: buyer extends → new deadline works
- [ ] Share deeplink: demand deeplink resolves to correct demand
- [ ] All state machine invalid transitions rejected with proper errors

## Blocked by

26