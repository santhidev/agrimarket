insert into public.products (id, name, category, unit) values
  ('11d0e0e0-0000-4000-8000-000000000001', 'มะม่วงน้ำดอกไม้', 'ผลไม้', 'กก.'),
  ('11d0e0e0-0000-4000-8000-000000000002', 'ข้าวหอมมะลิ', 'ข้าว', 'กก.')
on conflict (id) do nothing;

insert into public.product_grades (product_id, name, sort_order) values
  ('11d0e0e0-0000-4000-8000-000000000001', 'A', 0),
  ('11d0e0e0-0000-4000-8000-000000000001', 'B', 1),
  ('11d0e0e0-0000-4000-8000-000000000001', 'C', 2)
on conflict do nothing;
