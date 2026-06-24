Status: ready-for-agent

## What to build

Seller submits KYC (ID card photo + selfie photo). KYC submission stored in kyc_submissions table. Seller KYC UI in MAUI app (camera capture for photos). Status starts as PENDING.

## Acceptance criteria

- [ ] POST /kyc/submit accepts { idCardPhoto, selfiePhoto } from authenticated user
- [ ] Creates kyc_submissions record with status PENDING
- [ ] 1 user can have multiple submissions (resubmit after rejection)
- [ ] MAUI UI: KYC submit screen with camera capture (ID card + selfie)
- [ ] Web shows message "ส่ง KYC ได้ผ่าน mobile เท่านั้น"
- [ ] Unit tests: submit creates record, multiple submissions allowed

## Blocked by

02