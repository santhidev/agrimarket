Status: ready-for-agent

## What to build

End-to-end happy-path test (Playwright) covering the full matchmaking flow against a real Postgres + Redis: register a buyer + a seller (KYC approve the seller), buyer follows the product + creates a Demand, seller submits an Offer, buyer sees Best Offer, buyer selects + seller confirms, buyer matches, buyer sees the seller's contact. This is the integration glue that proves the vertical slices compose correctly.

## Acceptance criteria

- [ ] Playwright test boots the Next.js app + docker-compose DB/Redis
- [ ] Test drives: register buyer → register seller → admin KYC-approve seller → buyer follows product → buyer creates demand → seller submits offer → buyer best-offer → select → seller confirm → match → contacts visible
- [ ] Test asserts each step's outcome (status transitions, contact number visible to buyer)
- [ ] Test runs green in CI (`pnpm test:e2e`)

## Blocked by

15
