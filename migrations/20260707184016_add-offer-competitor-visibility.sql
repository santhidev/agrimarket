-- Issue 11 — Competitive bidding view: competitor visibility policy.
--
-- The competitive bidding view (#11) lets a seller see competing offers on a
-- Demand so they can adjust their price. The visibility rule: a competitor's
-- price is hidden until that competitor has "accepted" the buyer's current
-- counter-offer (#12) — i.e. the competitor's offer price ≤ the demand's
-- counter_offer_price. Before any counter-offer exists, no competitor price is
-- visible.
--
-- This migration adds the DB-layer enforcement of that rule so the route can
-- rely on RLS instead of filtering in JS (defense in depth, matches the
-- repo's pattern). A seller now sees:
--   - their own offers (any status) — already covered by offers_select_buyer_
--     or_seller_or_admin
--   - competitors' offers whose price ≤ the demand's counter_offer_price AND
--     the demand is OPEN (sellers only compete on OPEN demands)
--
-- The helper is_counter_offer_accepted(offer_price, demand_id) is SECURITY
-- DEFINER so it can read demands.counter_offer_price without re-entering the
-- offers RLS (avoids recursion). It returns false when no counter-offer is set.

-- --- Helper: has this offer met the demand's counter-offer? -----------------
--
-- Returns true when the given offer price is at or below the demand's latest
-- counter_offer_price. Returns false when the demand has no counter-offer
-- (NULL) or the demand doesn't exist. SECURITY DEFINER so the offers SELECT
-- policy can call it without recursing through offers RLS.
create or replace function public.is_counter_offer_accepted(
  offer_price numeric,
  demand_uuid uuid
) returns boolean
language sql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.demands d
    where d.id = demand_uuid
      and d.counter_offer_price is not null
      and d.status = 'OPEN'
      and offer_price <= d.counter_offer_price
  );
$$;

grant execute on function public.is_counter_offer_accepted(numeric, uuid) to authenticated;

-- --- RLS: a seller sees competitors whose offer met the counter-offer -------
--
-- Extends the existing offers_select_buyer_or_seller_or_admin policy set with a
-- new SELECT policy: a seller may read another seller's offer on an OPEN demand
-- only when that offer's price is at or below the demand's counter_offer_price.
-- The route still applies the visibility rule in JS for the response shape
-- (hiding non-accepted competitor details), but this policy is the DB backstop.
create policy "offers_select_competitor_accepted"
  on public.offers for select
  using (
    public.is_counter_offer_accepted(offers.price_per_unit, offers.demand_id)
  );
