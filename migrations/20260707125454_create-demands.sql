-- Issue 07 — Demand: create + browse + detail.
--
-- A Demand is a buyer's "wanted" post for a single Product: how much they
-- want, by when, and where (buyer_lat/lng for the Haversine distance calc on
-- the browse page). It tracks pending_quantity — the uncommitted portion of
-- `quantity` — which starts equal to `quantity` and drops as offers become
-- PENDING_SELLER_CONFIRMATION / CONFIRMED (#10). When pending_quantity hits 0
-- the demand becomes MATCHED. MVP lifecycle: OPEN → MATCHED → COMPLETED
-- (self-pickup, no in-system payment). EXPIRED (deadline) and CANCELLED
-- (buyer withdraws) are the terminal exits.
--
-- 1 Demand = 1 Product (no grade — buyer sees all grades; grade is
-- informational on offers, CONTEXT.md). Buyer-only writes; the browse list is
-- public so anonymous visitors (and not-yet-logged-in sellers) can see open
-- demands and be pulled into the funnel.
--
-- Mirrors the products/grades + kyc_submissions RLS pattern: public read on
-- open demands, owner-or-admin read on everything else, buyer-only insert
-- (buyer_id pinned to auth.uid() so a request can never forge another user's
-- demand).

create table if not exists public.demands (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete restrict,
  buyer_id          uuid not null references auth.users(id) on delete cascade,
  quantity          integer not null check (quantity > 0),
  pending_quantity  integer not null check (pending_quantity >= 0),
  status            text not null default 'OPEN'
                      check (status in ('OPEN','MATCHED','COMPLETED','EXPIRED','CANCELLED')),
  buyer_lat         double precision not null check (buyer_lat between -90 and 90),
  buyer_lng         double precision not null check (buyer_lng between -180 and 180),
  deadline          timestamptz not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Browse default order + the two filter axes the browse page exposes.
create index if not exists demands_status_created_idx
  on public.demands (status, created_at desc);
create index if not exists demands_product_idx
  on public.demands (product_id);
create index if not exists demands_status_idx
  on public.demands (status);
-- "My demands" — a logged-in buyer's own posts, newest first.
create index if not exists demands_buyer_created_idx
  on public.demands (buyer_id, created_at desc);

alter table public.demands enable row level security;

-- Read: public for OPEN demands (the marketplace browse — sellers must see
-- what buyers want before signing up / KYCing, per the Demand-driven go-to-
-- market in CONTEXT.md). Non-OPEN demands (MATCHED/COMPLETED/EXPIRED/
-- CANCELLED) are owner-or-admin only — they reveal a buyer's history and
-- shouldn't be public. Anonymous callers have no auth.uid(); the OR falls
-- through to the OPEN branch.
create policy "demands_select_open_or_owner_or_admin"
  on public.demands for select
  using (
    status = 'OPEN'
    or buyer_id = auth.uid()
    or public.is_current_admin()
  );

-- Insert: any authenticated user, but only for themselves (buyer_id must equal
-- the caller). The API also sets pending_quantity = quantity on insert via the
-- shared initialPendingQuantity helper — the DB can't default it to quantity
-- because DEFAULT cannot reference another column. Anonymous requests have no
-- auth.uid() and are blocked.
create policy "demands_insert_buyer_own"
  on public.demands for insert
  with check (buyer_id = auth.uid());

-- Update: the buyer owner (only while OPEN — enforced in canEditDemand at the
-- API) or an admin. Mirrors the profiles_update_own + _admin shape so the
-- future demand edit/cancel routes (#08) can flip fields without a service
-- client.
create policy "demands_update_owner_or_admin"
  on public.demands for update
  using (
    buyer_id = auth.uid()
    or public.is_current_admin()
  )
  with check (
    buyer_id = auth.uid()
    or public.is_current_admin()
  );
