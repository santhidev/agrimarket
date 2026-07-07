-- Issue 10 — Storage RLS for the offer-photos bucket.
--
-- The bucket is public-read (create-bucket --public) so buyers can view offer
-- photos on the demand detail page without a session. Writes are owner-scoped:
-- only the seller who uploaded an object can update/delete it. Mirrors the
-- kyc-documents policy shape exactly — uploaded_by is a text column storing
-- the user's JWT sub, compared against (auth.jwt() ->> 'sub'::text).
--
-- INSERT: any authenticated seller may upload; ownership is tracked via the
-- uploaded_by column (set by the SDK from the session) and enforced on
-- update/delete. No SELECT policy needed — the bucket's public flag bypasses
-- RLS for reads.

drop policy if exists "offer_photos_owner_insert" on storage.objects;
create policy "offer_photos_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket = 'offer-photos'
    and uploaded_by = (select auth.jwt() ->> 'sub'::text)
  );

drop policy if exists "offer_photos_owner_update" on storage.objects;
create policy "offer_photos_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket = 'offer-photos'
    and uploaded_by = (select auth.jwt() ->> 'sub'::text)
  )
  with check (
    bucket = 'offer-photos'
    and uploaded_by = (select auth.jwt() ->> 'sub'::text)
  );

drop policy if exists "offer_photos_owner_delete" on storage.objects;
create policy "offer_photos_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket = 'offer-photos'
    and uploaded_by = (select auth.jwt() ->> 'sub'::text)
  );
