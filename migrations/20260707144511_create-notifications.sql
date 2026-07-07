-- Issue 09 — Demand auto-expire + auto-complete (notifications table).
--
-- A Notification is a per-user in-app event the background jobs seed so that
-- #17 (Push notifications + read API + UI) can deliver them later. The two
-- Issue 09 cron jobs each insert one row per demand they transition:
--   - 'demand.expired'    — OPEN past deadline, flipped to EXPIRED
--   - 'demand.completed'  — MATCHED older than 7 days, flipped to COMPLETED
-- payload (jsonb) carries the demand id + product info so #17's UI can render
-- a row ("ประกาศมะม่วงน้ำดอกไม้ หมดอายุแล้ว") without a second round-trip.
--
-- RLS: owner-only SELECT. No user INSERT/UPDATE/DELETE policy — every write
-- comes from the cron routes' service-role client (createAdminClient, bypasses
-- RLS), because the jobs are system actors with no user session. Mirrors the
-- demands pattern (owner-or-admin read/write) but deliberately narrower: there
-- is no user-initiated write path for notifications yet.
--
-- type is plain text (not a CHECK list): #17 will add more event kinds
-- (offer.new, offer.confirmed, ...) and a CHECK list would force a migration
-- per kind. The shared DemandNotificationType / OfferNotificationType
-- vocabulary lives in @agrimarket/shared, not the DB.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- "My notifications" — a user's inbox, newest first. The read API (#17) orders
-- by created_at desc and paginates; unread_count groups by (user_id, read_at).
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Read: a user sees only their own notifications. Admin reads are not needed
-- for in-app notifications (they're user-scoped, not a moderation surface), so
-- there's no is_current_admin() branch — unlike demands/kyc. Anonymous callers
-- have no auth.uid() and match nothing.
create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid());
