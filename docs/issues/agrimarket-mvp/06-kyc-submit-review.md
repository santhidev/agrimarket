Status: done

## What to build

KYC: seller submits (ID card photo + selfie) via `POST /api/kyc`; admin reviews (`GET /api/admin/kyc/pending`, `POST /api/admin/kyc/:id/approve|reject`). Resubmit allowed after rejection (1 user → many submissions). Updates `users.kyc_status`. Follow is allowed before KYC approval (no gate on Follow — only Offer submission requires KYC approved).

## Acceptance criteria

- [x] Seller can submit KYC (photos upload + store)
- [x] Admin can list pending submissions
- [x] Admin can approve or reject (with reason); approve sets `users.kyc_status = APPROVED`
- [x] Seller can resubmit after rejection
- [x] A user with `kyc_status != APPROVED` cannot submit offers (enforced in 10)
- [x] Vitest: status transitions (None→Pending→Approved / None→Pending→Rejected→Pending→Approved)

## Blocked by

02

## Comments

### Implementation — 2026-07-07

**Schema (migration `20260707000805_kyc-submissions`):** `kyc_submissions(id uuid PK, user_id → auth.users on delete cascade, id_card_photo_url/key, selfie_url/key, status default 'PENDING' CHECK in PENDING/APPROVED/REJECTED, rejection_reason nullable, reviewed_by → auth.users on delete set null, submitted_at default now(), reviewed_at nullable)`. Indexes on `(status)`, `(user_id)`, and `(status, submitted_at)` for the admin FIFO queue + owner lookups. No unique partial index — the API enforces one in-flight submission via `canSubmitKyc`; a redundant second PENDING row would just be history.

The migration also adds two cross-cutting pieces:
- `profiles_update_admin` RLS policy on `public.profiles` — lets an admin update ANOTHER user's `kyc_status` (the existing `profiles_update_own` from #03 only allows `id = auth.uid()`). Required so approve/reject can flip the submitter's headline status without a service/admin client. A non-admin still cannot self-escalate: the policy requires `is_current_admin()`.
- Owner-only policies on `storage.objects` for the private `kyc-documents` bucket (SELECT/INSERT/UPDATE/DELETE, `uploaded_by = auth.jwt()->>'sub'`). KYC photos are PII (national ID + face) — never public. Admins read via the API-key/service surface (RLS bypass).

**Storage:** `kyc-documents` bucket created private via `npx @insforge/cli storage create-bucket kyc-documents --private`. Uploads happen client-side (InsForge idiom — save both `url` and `key`); the API stores both per photo.

**Shared package (`packages/shared/src/users/`):**
- `kyc-status.ts` — `KycSubmissionStatus` const-enum object (`Pending`/`Approved`/`Rejected` → DB string values) + type. Distinct from `KycStatus` in `enums.ts`, which is the headline value on `profiles.kyc_status` (None / Pending / Approved / Rejected).
- `kyc-transitions.ts` — the testable core: `canSubmitKyc(status)` (None|Rejected only) + `nextKycStatus(current, event)` returning the new profile status or null (illegal). 14 tests cover the acceptance lifecycles (None→Pending→Approved; None→Pending→Rejected→Pending→Approved) plus each illegal transition.
- `kyc-schemas.ts` — `createKycSubmissionSchema` (`.strict()`, `{idCardPhoto: {url,key}, selfie: {url,key}}`), `rejectKycSubmissionSchema` (mandatory `rejectionReason`), `kycSubmissionSchema` (camelCase read shape). 15 tests.

**API routes (`apps/web/app/api/`):**
- `POST /api/kyc` (auth, 401 anon) — zod-validates the url+key pairs; `canSubmitKyc` gate (409 if Pending or Approved with a Thai reason); inserts pinned to the caller; flips `profiles.kyc_status` to Pending. 400 on invalid body (only reachable when the user is allowed to submit).
- `GET /api/kyc` (auth) — own submissions, newest first (RLS enforces ownership).
- `GET /api/admin/kyc/pending` (admin) — `status='PENDING'`, `submitted_at` asc (oldest first).
- `POST /api/admin/kyc/:id/approve` (admin) — loads row → APPROVED + reviewer + timestamp → flips submitter's `profiles.kyc_status` to Approved. 404 if missing, 409 if not Pending.
- `POST /api/admin/kyc/:id/reject` (admin) — validates `rejectionReason` (400 if missing); 409 if not Pending; REJECTED + reason + reviewer + timestamp → flips profile to Rejected.
- Mapping (`mapKycSubmission` + `KycSubmissionRow` + `KYC_SUBMISSION_SELECT`) in the new `apps/web/app/api/kyc/mapping.ts`.

**Bug fix carried back to #05:** the review-endpoint load-then-update pattern returned **500 instead of 404** for a non-existent id. `.single()` returns BOTH an error (PGRST116) and null data when 0 rows match, so the old `if (findErr) return 500` short-circuited before the `if (!current) return 404`. Reordered to check `!current` first (404) across all four review routes (kyc approve/reject + product-suggestions approve/reject). Recorded in project memory as "404 vs 500 for missing id in review endpoints".

**Verified end-to-end (dev server on :3000, Playwright browser auth):**
- anonymous → all 5 endpoints → 401 ✓
- non-admin → 3 admin endpoints → 403 ✓; `GET /api/kyc` → 200 empty (RLS hides others) ✓
- non-admin submit (None) → 201, userId pinned to caller ✓; profile flipped to Pending ✓
- non-admin resubmit while Pending → 409 ("คุณมีคำขอ KYC รอตรวจสอบอยู่แล้ว") ✓
- admin: pending queue lists the submission; reject without reason → 400; reject with Thai reason → 200 (REJECTED, reason persisted, reviewer); double-reject → 409; profile flipped to Rejected ✓
- non-admin resubmit after rejection → 201 (new PENDING); my list shows both rows newest-first ✓
- admin approve → 200 (APPROVED, reviewer e50aab8b, timestamp); double-approve → 409; profile flipped to Approved; pending queue empty ✓
- **Lifecycle None→Pending→Rejected→Pending→Approved reproduced in real rows** (acceptance criterion 6) ✓
- non-admin submit while Approved → 409 ("คุณได้รับการยืนยันตัวตนแล้ว") ✓ (terminal)
- missing-id approve/reject → 404 (kyc + product-suggestions, all 4 routes) ✓ (post-fix)
- ownership isolation: approved non-admin sees only their own 2 submissions, none from anyone else ✓
- `pnpm typecheck` (shared + web) ✓; `pnpm build` (web — all 4 new routes listed) ✓
- Vitest: 101 shared + 4 web = 105 tests green ✓

**Notes for downstream issues:**
- `KycStatus` + `canSubmitKyc` are exported from `@agrimarket/shared` — #10 (Offer submit) should gate with `if (!canSubmitKyc(profile.kycStatus) && profile.kycStatus !== KycStatus.Approved) return 403` (i.e. require Approved specifically).
- The `profiles_update_admin` policy is generic (any admin profile update), not KYC-specific — reusable for #18 admin user management and future admin-driven status changes.
- KYC UI (upload form + admin review queue) deferred to #18 (API-only per acceptance criteria). Client uploads to the `kyc-documents` bucket via `createBrowserClient()` then POSTs the url+key pairs.
- Test data cleaned (kyc_submissions → 0, all profiles back to kyc_status None) so the dev DB is in its seeded state.

**Dev-server gotcha (memory):** new dynamic App Router routes (`[id]/approve`, `[id]/reject`) cold-compiled to 500 with `Cannot find module './vendor-chunks/tr46@0.0.3.js'` (webpack cache corruption). Fixed by restarting `next dev`. Static routes (kyc, kyc/pending) compiled fine. Worth a server restart after adding a new `[id]` route on this stack.
