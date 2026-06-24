Status: ready-for-agent

## What to build

Seller can suggest a new product not in catalog. Admin reviews suggestions (approve/reject with reason). When approved, product is created in catalog. Product suggestion UI for sellers + admin review UI.

## Acceptance criteria

- [ ] POST /products/suggest accepts { name, category, unit } from any authenticated user
- [ ] GET /admin/products/suggestions returns pending suggestions
- [ ] POST /admin/products/suggestions/:id/approve creates product from suggestion
- [ ] POST /admin/products/suggestions/:id/reject with reason
- [ ] Seller UI: suggest product form
- [ ] Admin UI: suggestions queue with approve/reject
- [ ] Unit tests: suggestion submit, approval creates product, rejection with reason

## Blocked by

03