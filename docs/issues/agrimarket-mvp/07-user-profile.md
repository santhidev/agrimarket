Status: ready-for-agent

## What to build

User profile view with phone, KYC status, credit tier, buyer_score/seller_score (placeholder default 0). Any user can view their own profile + other users' profiles (for trust evaluation). Profile UI in Blazor + MAUI.

## Acceptance criteria

- [ ] GET /users/:id/profile returns { user, buyerScore, sellerScore, creditTier }
- [ ] buyer_score and seller_score default to 0 (placeholder)
- [ ] creditTier returned from users.tier
- [ ] Profile UI: shows phone, KYC status badge, credit tier, scores (greyed out "Phase 2")
- [ ] Unit tests: profile retrieval, default scores, KYC status display

## Blocked by

02