-- Issue 06 — KYC: submit + admin review.
--
-- Sellers must be KYC-approved before submitting offers (#10). A submission is
-- an ID-card photo + a selfie (uploaded to Storage by the client, which returns
-- a url+key pair per file — both are persisted). Admins review pending
-- submissions and approve/reject; the approve/reject endpoints also flip the
-- user's headline profiles.kyc_status so offer submission can gate on it.
--
-- One user may have many submissions (resubmit after rejection). The latest
-- submission's resolution wins on profiles.kyc_status. The API enforces "one
-- in-flight submission at a time" via canSubmitKyc (None|Rejected only); the DB
-- does not need a unique partial index because a second PENDING row would just
-- be redundant history.
--
-- Mirrors the products/grades + product_suggestions RLS pattern from Issues
-- 04/05: owner-scoped reads + admin, owner-only inserts, admin-only updates.

create table if not exists public.kyc_submissions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  id_card_photo_url   text not null,
  id_card_photo_key   text not null,
  selfie_url          text not null,
  selfie_key          text not null,
  status              text not null default 'PENDING'
                        check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason    text null,
  reviewed_by         uuid null references auth.users(id) on delete set null,
  submitted_at        timestamptz not null default now(),
  reviewed_at         timestamptz null
);

-- Admin review queue (pending FIFO) and "my submissions" (owner, newest first).
create index if not exists kyc_submissions_status_idx
  on public.kyc_submissions (status);
create index if not exists kyc_submissions_user_idx
  on public.kyc_submissions (user_id);
create index if not exists kyc_submissions_pending_queue_idx
  on public.kyc_submissions (status, submitted_at);

alter table public.kyc_submissions enable row level security;

-- Read: the owner sees their own submissions; admins see all (review queue).
create policy "kyc_submissions_select_own_or_admin"
  on public.kyc_submissions for select
  using (
    user_id = auth.uid()
    or public.is_current_admin()
  );

-- Insert: any authenticated user, but only for themselves (user_id must equal
-- the caller). Anonymous requests have no auth.uid() and are blocked.
create policy "kyc_submissions_insert_own"
  on public.kyc_submissions for insert
  with check (user_id = auth.uid());

-- Update: admin only (approve/reject, set reviewer + reason/timestamp). The
-- submitter can never edit a submission after it is created.
create policy "kyc_submissions_update_admin"
  on public.kyc_submissions for update
  using (public.is_current_admin())
  with check (public.is_current_admin());

-- Admins must be able to update OTHER users' profiles.kyc_status when they
-- approve/reject KYC. The existing profiles_update_own policy (Issue 03) only
-- allows id = auth.uid(); adding this admin policy lets the API flip the
-- headline status without falling back to a service/admin client. A user still
-- cannot escalate their own kyc_status: this policy requires
-- public.is_current_admin(), and a non-admin calling it on their own row would
-- still be denied by the AND of all matching UPDATE policies.
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_current_admin())
  with check (public.is_current_admin());

-- Storage: owner-only on the private kyc-documents bucket. KYC photos are PII
-- (national ID card + face) so they must never be public. The owner may upload
-- and read their own submissions; admins read via the API-key/service surface
-- (RLS bypass), not via these authenticated policies. Mirrors the InsForge
-- owner-only storage pattern.
create policy "kyc_documents_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket = 'kyc-documents'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  );

create policy "kyc_documents_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket = 'kyc-documents'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  );

create policy "kyc_documents_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket = 'kyc-documents'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  )
  with check (
    bucket = 'kyc-documents'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  );

create policy "kyc_documents_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket = 'kyc-documents'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  );
