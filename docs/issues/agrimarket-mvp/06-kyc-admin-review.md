Status: ready-for-agent

## What to build

Admin reviews KYC submissions. Admin sees pending list, approves or rejects with reason. On approve: users.kyc_status = APPROVED. On reject: users.kyc_status = REJECTED + rejection_reason saved. Seller can resubmit after rejection. Admin Blazor WASM KYC review UI. SLA: 1-7 วันทำการ.

## Acceptance criteria

- [ ] GET /admin/kyc/pending returns pending submissions
- [ ] POST /admin/kyc/:id/approve sets status APPROVED + updates users.kyc_status
- [ ] POST /admin/kyc/:id/reject with reason sets status REJECTED + updates users.kyc_status
- [ ] Approved user can submit offers (checked in OfferModule)
- [ ] Rejected user can resubmit KYC (new submission record)
- [ ] Admin UI: KYC queue with photos + approve/reject buttons
- [ ] Unit tests: approve flow, reject flow, resubmit after rejection, kyc_status sync

## Blocked by

05