-- Issue 17 — Notifications: add title + body text columns.
--
-- Issue 09 created public.notifications with (type, payload) only; #17 adds
-- title + body so the client renders Thai strings directly from the row
-- instead of mapping type → string in the browser. The columns are nullable
-- so the migration is non-breaking on existing rows (the cron routes are
-- edited in a later task to populate them going forward; legacy rows degrade
-- with a UI fallback "การแจ้งเตือน").
--
-- No NOT NULL constraint: the app layer (seedNotifications helper + zod)
-- always sets title/body on new inserts, and the DB constraint would force a
-- backfill of legacy rows with a guessed value. Mirrors the demands pattern
-- (constraint in the app, not the DB) and keeps the migration cheap.

alter table public.notifications
  add column if not exists title text,
  add column if not exists body  text;
