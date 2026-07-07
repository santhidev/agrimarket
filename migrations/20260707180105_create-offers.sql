-- Issue 10 — Offer: submit + edit + withdraw.
--
-- An Offer is a seller's response to a Demand: their price, quantity, grade,
-- pickup location, ready date, and optional product photos. 1 seller = 1 offer
-- per Demand (unique demand_id + seller_id) — a seller edits their existing
-- offer rather than submitting a second. MVP lifecycle: ACTIVE →
-- PENDING_SELLER_CONFIRMATION → CONFIRMED → MATCHED (self-pickup), with
-- WITHDRAWN (seller pulls), REJECTED (buyer dismisses), EXPIRED, CANCELLED
-- (demand cancelled — Issue 08 cascade), DECLINED (seller didn't confirm in
-- 24h) as terminal exits (see CONTEXT.md "State Machines").
--
-- accepted_quantity is null until the buyer selects (#11); the offer's offered
-- quantity is `quantity`. pending_quantity on the parent demand drops as
-- offers become PENDING/CONFIRMED (#11); Issue 10 only creates ACTIVE offers,
-- so pending_quantity is untouched here.
--
-- RLS: the demand's buyer sees all offers on their demand; a seller sees only
-- their own offers; admins see all. Offers are NOT public — only the OPEN
-- demand list is (sellers browse demands, then submit offers; offers
-- themselves are buyer/seller-private). Mirrors the demands RLS shape but
-- with a buyer-via-demand join instead of a single owner column.
--
-- offer_photos mirrors the KYC url+key pattern (#06): the client uploads to
-- Storage first, then posts the resulting pairs. On offer UPDATE, photos are
-- replaced wholesale (delete old + insert new). sort_order preserves the
-- seller's chosen photo order on the demand detail page.

create table if not exists public.offers (
  id                uuid primary key default gen_random_uuid(),
  demand_id         uuid not null references public.demands(id) on delete cascade,
  seller_id         uuid not null references auth.users(id) on delete cascade,
  product_grade_id  uuid null references public.product_grades(id) on delete set null,
  price_per_unit    numeric(12,2) not null check (price_per_unit > 0),
  quantity          integer not null check (quantity > 0),
  accepted_quantity integer null check (accepted_quantity >= 0),
  status            text not null default 'ACTIVE'
                      check (status in ('ACTIVE','PENDING_SELLER_CONFIRMATION','CONFIRMED','MATCHED','WITHDRAWN','REJECTED','EXPIRED','CANCELLED','DECLINED')),
  pickup_lat        double precision not null check (pickup_lat between -90 and 90),
  pickup_lng        double precision not null check (pickup_lng between -180 and 180),
  ready_date        date not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 1 seller = 1 offer per Demand (Issue 10 acceptance). A second insert by the
-- same seller on the same demand hits this unique index → the route returns
-- 409 "edit the existing one instead". Includes WITHDRAWN rows: a withdrawn
-- offer is terminal, so the seller cannot re-submit on the same demand (they
-- would have to... they can't — CONTEXT.md says WITHDRAWN is terminal).
create unique index if not exists offers_demand_seller_uniq
  on public.offers (demand_id, seller_id);
create index if not exists offers_demand_idx
  on public.offers (demand_id, status);
create index if not exists offers_seller_idx
  on public.offers (seller_id, status);

create table if not exists public.offer_photos (
  id          uuid primary key default gen_random_uuid(),
  offer_id    uuid not null references public.offers(id) on delete cascade,
  url         text not null,
  key         text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists offer_photos_offer_idx
  on public.offer_photos (offer_id, sort_order);

-- updated_at trigger — reuses the platform's built-in system.update_updated_at()
-- (same one products uses). No custom function needed.
drop trigger if exists offers_touch_updated_at on public.offers;
create trigger offers_touch_updated_at
  before update on public.offers
  for each row execute function system.update_updated_at();

alter table public.offers enable row level security;
alter table public.offer_photos enable row level security;

-- Read offers: the demand's buyer, the offer's seller, or an admin. A buyer
-- sees all offers competing for their demand; a seller sees only their own
-- offers; anon sees nothing (offers are not public — only the OPEN demand
-- list is). The buyer join goes through demands (buyer_id = auth.uid()).
create policy "offers_select_buyer_or_seller_or_admin"
  on public.offers for select
  using (
    seller_id = auth.uid()
    or exists (
      select 1 from public.demands d
      where d.id = offers.demand_id
        and d.buyer_id = auth.uid()
    )
    or public.is_current_admin()
  );

-- Insert: seller only, for themselves. The API also checks the demand is OPEN
-- (acceptsOffers) and the seller is KYC-approved before inserting, but RLS
-- enforces the ownership invariant at the DB layer.
create policy "offers_insert_seller_own"
  on public.offers for insert
  with check (seller_id = auth.uid());

-- Update: seller only. The API gates on canEditOffer (ACTIVE-only); RLS
-- enforces ownership so a forged client can't edit another seller's offer.
create policy "offers_update_seller_own"
  on public.offers for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- Delete: seller only. The route does a soft WITHDRAWN (UPDATE status), not a
-- hard delete — but the DELETE policy covers the hard-delete path for
-- completeness (e.g. admin cleanup).
create policy "offers_delete_seller_own"
  on public.offers for delete
  using (seller_id = auth.uid());

-- offer_photos: same visibility as the parent offer. The join through offers
-- → demands lets the demand's buyer see photos on offers they're evaluating.
create policy "offer_photos_select_via_offer"
  on public.offer_photos for select
  using (
    exists (
      select 1 from public.offers o
      where o.id = offer_photos.offer_id
        and (
          o.seller_id = auth.uid()
          or exists (
            select 1 from public.demands d
            where d.id = o.demand_id
              and d.buyer_id = auth.uid()
          )
          or public.is_current_admin()
        )
    )
  );

-- Insert photos: only the offer's seller. The route bulk-inserts photos right
-- after creating the offer (same seller_id), so this pins ownership.
create policy "offer_photos_insert_via_offer"
  on public.offer_photos for insert
  with check (
    exists (
      select 1 from public.offers o
      where o.id = offer_photos.offer_id
        and o.seller_id = auth.uid()
    )
  );

-- Delete photos: only the offer's seller (for the wholesale-replace on PATCH).
create policy "offer_photos_delete_via_offer"
  on public.offer_photos for delete
  using (
    exists (
      select 1 from public.offers o
      where o.id = offer_photos.offer_id
        and o.seller_id = auth.uid()
    )
  );
