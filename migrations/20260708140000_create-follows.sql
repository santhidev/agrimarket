-- Issue 16 — Follow + Unfollow products.
--
-- A Follow is a user's subscription to a Product: when a new Demand is posted
-- for a followed product (#17) the user is notified. Follow is the main
-- go-to-market lever for sellers: register → follow a product → wait for the
-- push → open the app and submit an offer (CONTEXT.md "Follow ได้ทันทีหลัง
-- สมัคร — ไม่ต้องรอ KYC").
--
-- (user_id, product_id) is unique: a user follows each product at most once.
-- The follow POST route is idempotent — a duplicate follow returns the
-- existing row (200), not an error. The unique index below is the DB backstop
-- for a concurrent-race insert; the route handles the resulting insert failure
-- by re-reading.
--
-- RLS: a user sees only their own follows; admins see all. Only the owner may
-- insert/delete their follows. No UPDATE — a follow either exists or it
-- doesn't (no fields to change), so no UPDATE policy. The fan-out for #17's
-- notifications runs server-side via the service-role admin client (bypasses
-- RLS), so this policy only governs the user-facing follow/unfollow/list
-- routes.

create table if not exists public.follows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- 1 user = 1 follow per product. Declared as a separate unique index (not an
-- inline UNIQUE) because the InsForge SQL parser rejected inline
-- `UNIQUE ... NULLS NOT DISTINCT` inside CREATE TABLE (see the note at the top
-- of 20260706131000_create-products-grades.sql). The route's idempotent
-- select-then-insert treats this index as the race backstop.
create unique index if not exists follows_user_product_uniq
  on public.follows (user_id, product_id);

-- Look-up 1: "who follows this product?" — used by #17's demand-notification
-- fan-out. Look-up 2: "what does this user follow?" — the GET /api/follows
-- list route.
create index if not exists follows_product_idx
  on public.follows (product_id);
create index if not exists follows_user_idx
  on public.follows (user_id);

alter table public.follows enable row level security;

-- Read: a user sees only their own follows; admins see all.
create policy "follows_select_own_or_admin"
  on public.follows for select
  using (
    user_id = auth.uid()
    or public.is_current_admin()
  );

-- Insert: a user can only follow for themselves. (on delete cascade on the
-- user FK means a deleted user's follows go with them.)
create policy "follows_insert_own"
  on public.follows for insert
  with check (user_id = auth.uid());

-- Delete: a user can only unfollow their own follows.
create policy "follows_delete_own"
  on public.follows for delete
  using (user_id = auth.uid());
