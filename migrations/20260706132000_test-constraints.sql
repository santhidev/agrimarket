-- test CHECK constraints + btrim
alter table public.products
  add constraint products_name_chk check (length(btrim(name)) > 0),
  add constraint products_category_chk check (length(btrim(category)) > 0),
  add constraint products_shelf_chk check (shelf_life_hours is null or shelf_life_hours > 0);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_name_idx on public.products (name);
