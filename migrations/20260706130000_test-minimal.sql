create table if not exists public._migtest (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

drop table public._migtest;
