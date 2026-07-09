-- Add a redundant FK from offers.seller_id → profiles(id).
--
-- offers.seller_id already references auth.users(id), and profiles.id
-- references auth.users(id) 1:1 — so a seller's profile row always exists
-- (the OTP verify edge function find-or-creates it). This redundant FK is
-- logically equivalent: every offers.seller_id value IS a profiles.id value.
--
-- Why it's needed: PostgREST (the InsForge DB API) resolves nested selects via
-- FK relationships in the schema cache. The competitive bidding view
-- (GET /api/demands/:id/offers, Issue 11) and the contacts view
-- (GET /api/demands/:id/contacts, Issue 15) join seller phone via
-- `seller:profiles!offers_seller_id_fkey(phone)`. Without a direct
-- offers → profiles FK, PostgREST returns PGRST200 ("Could not find a
-- relationship between 'offers' and 'profiles'") and the route 500s.
--
-- The FK is NOT VALID (doesn't validate existing rows) so the ALTER is instant
-- on a populated table; new writes are still enforced. Caught by the Issue 19
-- E2E happy-path run.

alter table public.offers
  add constraint offers_seller_profile_fkey
  foreign key (seller_id) references public.profiles(id) on delete cascade
  not valid;
