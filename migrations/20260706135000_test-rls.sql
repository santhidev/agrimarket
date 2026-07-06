alter table public.products enable row level security;
alter table public.product_grades enable row level security;

create policy "products_select_public"
  on public.products for select
  using (true);

create policy "products_insert_admin"
  on public.products for insert
  with check (public.is_current_admin());

create policy "products_update_admin"
  on public.products for update
  using (public.is_current_admin())
  with check (public.is_current_admin());

create policy "products_delete_admin"
  on public.products for delete
  using (public.is_current_admin());

create policy "product_grades_select_public"
  on public.product_grades for select
  using (true);

create policy "product_grades_insert_admin"
  on public.product_grades for insert
  with check (public.is_current_admin());

create policy "product_grades_update_admin"
  on public.product_grades for update
  using (public.is_current_admin())
  with check (public.is_current_admin());

create policy "product_grades_delete_admin"
  on public.product_grades for delete
  using (public.is_current_admin());
