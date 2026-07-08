-- Issue 14 — Select offers + Seller confirmation.
--
-- The buyer-select handshake needs the demand's buyer to UPDATE offers on
-- their demand: POST /api/demands/:id/select flips chosen offers to
-- PENDING_SELLER_CONFIRMATION (and sets accepted_quantity), and on re-select
-- reverts prior PENDING/CONFIRMED offers to ACTIVE. The existing UPDATE
-- policy (offers_update_seller_own) only permits the offer's seller, so a
-- buyer-side UPDATE policy is added here.
--
-- Column scope: Postgres RLS policies are row-level, not column-level, so
-- this policy permits the buyer to UPDATE any column on their demand's
-- offers in principle. The route self-restricts to status +
-- accepted_quantity (it never writes price/quantity/photos as the buyer —
-- those remain seller-only via the route logic). A future hardening pass
-- could add a column-level GRANT mask, but the route's discipline + the
-- SSR client (RLS-bounded) are the current enforcement.
--
-- Admin is also covered: the existing seller-only UPDATE policy left admin
-- UPDATEs implicit (none existed). A separate admin-any policy makes admin
-- overrides explicit and future-proof (admin UI, manual corrections).
--
-- Confirm + decline (seller-side status flips) reuse the existing
-- offers_update_seller_own policy unchanged.

-- Buyer of the parent demand may UPDATE offers on their own demand. The
-- using + with check are identical so the buyer can both target existing
-- rows and the post-update row must still belong to their demand.
create policy "offers_update_buyer_via_demand"
  on public.offers for update
  using (
    exists (
      select 1 from public.demands d
      where d.id = offers.demand_id
        and d.buyer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.demands d
      where d.id = offers.demand_id
        and d.buyer_id = auth.uid()
    )
  );

-- Admin may UPDATE any offer (overrides + corrections). Mirrors the admin
-- clause on the demands/kyc policies via the shared is_current_admin() helper.
create policy "offers_update_admin_any"
  on public.offers for update
  using (public.is_current_admin())
  with check (public.is_current_admin());
