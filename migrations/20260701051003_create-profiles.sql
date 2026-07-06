-- public.profiles — AgriMarket user profile data (1:1 with auth.users).
--
-- Per ADR 0003 (amended): profile fields live in a dedicated table rather than
-- auth.users.user_metadata so the admin dashboard (#18) can filter/aggregate
-- and future RLS policies can reference typed columns (is_admin, kyc_status).

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  phone         text not null unique,
  tier          text not null default 'None',
  kyc_status    text not null default 'None',
  buyer_score   integer not null default 0,
  seller_score  integer not null default 0,
  is_admin      boolean not null default false,
  is_rider      boolean not null default false,
  is_hub_staff  boolean not null default false,
  hub_id        uuid null,
  created_at    timestamptz not null default now()
);

create index if not exists profiles_is_admin_idx     on public.profiles (is_admin);
create index if not exists profiles_kyc_status_idx   on public.profiles (kyc_status);

-- updated_at is not needed yet; profile fields change via admin or the user
-- themselves (KYC submit in #06). Add a touched_at when writes land.

alter table public.profiles enable row level security;

-- is_current_admin(): SECURITY DEFINER helper so the admin check does not
-- recurse into the profiles RLS policy it is used in. (A plain sub-query on
-- public.profiles from inside a profiles policy triggers infinite recursion.)
create or replace function public.is_current_admin()
returns boolean
language sql
security definer set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$;

-- A user may read their own row; admins may read every row.
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_current_admin()
  );

-- A user may insert only their own row (signup auto-create).
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

-- A user may update only their own row, and may NEVER change is_admin, tier, or
-- scores through this policy (those are admin-only via the service client).
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile row whenever a new auth.users row appears.
-- The phone-otp edge function also inserts a profile; this trigger is a
-- belt-and-suspenders fallback that keeps profiles in sync even if the edge
-- function is bypassed (e.g. OAuth signup in a future issue).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_phone text;
begin
  -- Email looks like "<phone>@phone.agrimarket" (see phone-otp edge function).
  v_phone := split_part(new.email, '@', 1);
  insert into public.profiles (id, phone)
  values (new.id, v_phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
