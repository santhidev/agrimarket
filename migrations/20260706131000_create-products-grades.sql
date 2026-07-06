-- Issue 04 — Catalog: products + product_grades.
--
-- Originally authored as a single migration; the InsForge SQL parser rejected
-- inline `UNIQUE (...) NULLS NOT DISTINCT` inside CREATE TABLE, so the change
-- was split across 20260706130000…20260706136000 to isolate each DDL group
-- during debugging. The full set is applied and must run together as a unit:
--
--   20260706130000  test-minimal           (parser probe — creates + drops a
--                                           scratch table; net effect: nothing)
--   20260706131000  create-products-grades (this file — public.products)
--   20260706132000  test-constraints       (CHECK constraints + indexes)
--   20260706133000  test-grades            (public.product_grades + unique idx)
--   20260706134000  test-trigger           (auto-update updated_at)
--   20260706135000  test-rls               (public read / admin write policies)
--   20260706136000  test-seed              (มะม่วง A/B/C + ข้าวหอมมะลิ)

create table if not exists public.products (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  category              text not null,
  unit                  text not null default 'กก.',
  requires_cold_chain   boolean not null default false,
  is_fragile            boolean not null default false,
  shelf_life_hours      integer null,
  is_stackable          boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
