Status: ready-for-agent

## What to build

Admin product management with grades. Admin creates products (name, category, unit, transport profiles) + grades (e.g., ทุเรียน A/B/C). Some products have no grades = "มาตรฐาน". Users browse products with grades visible. Admin Blazor WASM product management UI + browse UI in web/mobile.

## Acceptance criteria

- [ ] POST /admin/products creates product with grades array
- [ ] GET /products returns products with their grades
- [ ] GET /products/:id/grades returns grades for a product
- [ ] POST /admin/products/:id/grades adds a grade
- [ ] PATCH /admin/products/:id/grades/:gradeId updates a grade
- [ ] DELETE /admin/products/:id/grades/:gradeId removes a grade
- [ ] PATCH /admin/products/:id updates product
- [ ] Admin UI: product list + create/edit form with grades management
- [ ] Browse UI: product list with grades shown
- [ ] Unit tests: product CRUD, grades CRUD, validation

## Blocked by

02