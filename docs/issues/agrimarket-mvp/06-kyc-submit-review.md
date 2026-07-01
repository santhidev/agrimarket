Status: ready-for-agent

## What to build

KYC: seller submits (ID card photo + selfie) via `POST /api/kyc`; admin reviews (`GET /api/admin/kyc/pending`, `POST /api/admin/kyc/:id/approve|reject`). Resubmit allowed after rejection (1 user → many submissions). Updates `users.kyc_status`. Follow is allowed before KYC approval (no gate on Follow — only Offer submission requires KYC approved).

## Acceptance criteria

- [ ] Seller can submit KYC (photos upload + store)
- [ ] Admin can list pending submissions
- [ ] Admin can approve or reject (with reason); approve sets `users.kyc_status = APPROVED`
- [ ] Seller can resubmit after rejection
- [ ] A user with `kyc_status != APPROVED` cannot submit offers (enforced in 10)
- [ ] Vitest: status transitions (None→Pending→Approved / None→Pending→Rejected→Pending→Approved)

## Blocked by

02
