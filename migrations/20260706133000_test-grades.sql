create table if not exists public.product_grades (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  name          text not null check (length(btrim(name)) > 0),
  description   text null,
  sort_order    integer not null default 0 check (sort_order >= 0),
  created_at    timestamptz not null default now()
);
-- one (product_id, name) pair per product. Name is CHECKed non-empty above, so
-- ordinary UNIQUE semantics suffice (no need for NULLS NOT DISTINCT).
create unique index if not exists product_grades_product_name_uniq
  on public.product_grades (product_id, name);
create index if not exists product_grades_product_id_idx on public.product_grades (product_id);
create index if not exists product_grades_sort_order_idx  on public.product_grades (product_id, sort_order);
