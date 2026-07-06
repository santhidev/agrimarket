-- Issue 05 — Catalog: product suggestions.
--
-- Any authenticated user can propose a new catalog product; admins review and
-- approve/reject. On approve, the API creates a `products` row from the
-- suggestion and flips the suggestion to APPROVED (the suggestion is kept for
-- history — it is never deleted). Mirrors the products/grades RLS pattern from
-- Issue 04: public read is NOT granted here (suggestions are owner+admin only),
-- writes are gated by auth.uid() / public.is_current_admin().

create table if not exists public.product_suggestions (
  id                uuid primary key default gen_random_uuid(),
  requester_id      uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  category          text not null,
  unit              text not null default 'กก.',
  status            text not null default 'PENDING'
                      check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason  text null,
  reviewed_by       uuid null references auth.users(id) on delete set null,
  submitted_at      timestamptz not null default now(),
  reviewed_at       timestamptz null
);

-- Review queue lookups (admin: pending FIFO) and "my suggestions" (owner).
create index if not exists product_suggestions_status_idx
  on public.product_suggestions (status);
create index if not exists product_suggestions_requester_idx
  on public.product_suggestions (requester_id);
create index if not exists product_suggestions_pending_queue_idx
  on public.product_suggestions (status, submitted_at);

alter table public.product_suggestions enable row level security;

-- Read: the requester sees their own suggestions; admins see all.
create policy "product_suggestions_select_own_or_admin"
  on public.product_suggestions for select
  using (
    requester_id = auth.uid()
    or public.is_current_admin()
  );

-- Insert: any authenticated user, but only for themselves (requester_id must
-- equal the caller). Anonymous requests have no auth.uid() and are blocked.
create policy "product_suggestions_insert_own"
  on public.product_suggestions for insert
  with check (requester_id = auth.uid());

-- Update: admin only (approve/reject, set reviewer + reason/timestamp). The
-- requester can never edit a submitted suggestion.
create policy "product_suggestions_update_admin"
  on public.product_suggestions for update
  using (public.is_current_admin())
  with check (public.is_current_admin());
