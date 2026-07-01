Status: ready-for-agent

## What to build

Catalog: admin CRUD for products and product grades, plus public browse. `products` (name, category, unit, requires_cold_chain, is_fragile, shelf_life_hours, is_stackable) and `product_grades` (product_id, name, description, sort_order). Some products have no grades → default "มาตรฐาน". Public `GET /api/products` and `GET /api/products/:id/grades`. Admin-only create/update/delete.

## Acceptance criteria

- [ ] Admin can create/update/delete a product
- [ ] Admin can create/update/delete grades for a product
- [ ] Products without grades return a single "มาตรฐาน" grade on read
- [ ] `GET /api/products` lists products (public)
- [ ] `GET /api/products/:id/grades` lists grades (public)
- [ ] Browse page renders products + grades
- [ ] Vitest: zod schema validation, grade default, admin gate on writes

## Blocked by

01
