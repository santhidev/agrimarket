-- Idempotent admin bootstrap: mark a profile as admin by phone.
--
-- Email format is "<phone>@phone.agrimarket" (see phone-otp edge function).
-- The InsForge CLI `db query` takes inline SQL only (no psql variable binding),
-- so substitute the phone literal before running.
--
-- Default admin phone is 0899999901 (the registered test admin).
--
-- Run with, e.g.:
--   npx @insforge/cli db query \
--     "insert into public.profiles (id, phone, is_admin) \
--      select u.id, split_part(u.email,'@',1), true \
--      from auth.users u \
--      where u.email = '0899999901@phone.agrimarket' \
--      on conflict (id) do update set is_admin = true;"

insert into public.profiles (id, phone, is_admin)
select u.id, split_part(u.email, '@', 1), true
from auth.users u
where u.email = '0899999901@phone.agrimarket'
on conflict (id) do update
  set is_admin = true,
      phone = excluded.phone;
