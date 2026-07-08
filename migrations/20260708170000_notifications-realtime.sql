-- Issue 17 — Notifications realtime delivery via a DB trigger.
--
-- Every INSERT on public.notifications broadcasts a 'notification:new' event
-- to the owner's per-user channel ("notif:<user_id>"). This covers cron-route
-- inserts automatically (no need to edit the cron routes to publish) and
-- keeps the wired routes ignorant of realtime. Mirrors the insforge-cli
-- realtime reference's "publish from app-owned tables" pattern.
--
-- Channel RLS restricts subscription to the channel's owning user only.

-- 1. Channel pattern: one channel per user.
insert into realtime.channels (pattern, description, enabled)
values ('notif:%', 'Per-user notification inbox', true)
on conflict (pattern) do update
set description = excluded.description,
    enabled      = excluded.enabled;

-- 2. Channel RLS: a user may only subscribe to their own channel. Anonymous
--    callers have no auth.uid() and match nothing.
alter table realtime.channels enable row level security;

create policy "channels_select_own_notif"
  on realtime.channels for select
  to authenticated
  using (
    pattern = 'notif:%'
    and split_part(realtime.channel_name(), ':', 2)::uuid = auth.uid()
  );

-- 3. Trigger function: publish the new row to the owner's channel. SECURITY
--    DEFINER so the function runs as its owner (postgres), allowing it to
--    call realtime.publish() regardless of the inserting role (the inserts
--    come from the service-role admin client in cron routes + wired routes).
create or replace function public.notify_notification_inserted()
returns trigger as $$
begin
  perform realtime.publish(
    'notif:' || new.user_id::text,
    'notification:new',
    jsonb_build_object(
      'id',         new.id,
      'type',       new.type,
      'title',      new.title,
      'body',       new.body,
      'payload',    new.payload,
      'created_at', new.created_at
    )
  );
  return new;
end;
$$ language plpgsql security definer;

-- 4. Trigger: AFTER INSERT on public.notifications.
create trigger notifications_realtime_trigger
after insert on public.notifications
for each row
execute function public.notify_notification_inserted();
