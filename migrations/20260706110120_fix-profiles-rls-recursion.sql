-- Fix infinite recursion in the profiles SELECT policy.
--
-- The original policy checked admin status by sub-querying public.profiles
-- from within a policy on public.profiles — PostgreSQL detects this as
-- infinite recursion (error 42P17) and blocks every read.
--
-- Fix: move the "is the current user an admin?" lookup into a SECURITY
-- DEFINER function. SECURITY DEFINER runs with the function owner's
-- privileges (project_admin via migration), so the inner profiles read is
-- NOT subject to RLS — no recursion. search_path is pinned per the
-- access-control guidance.

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

-- Replace the recursive policy.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_current_admin()
  );
