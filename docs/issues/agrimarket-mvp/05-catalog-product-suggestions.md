Status: ready-for-agent

## What to build

Product suggestions: any user can suggest a new product (`POST /api/product-suggestions`), admin reviews (`GET /api/admin/product-suggestions/pending`, `POST /api/admin/product-suggestions/:id/approve|reject`). On approve, a `product` is created from the suggestion. Status: PENDING / APPROVED / REJECTED with optional rejection_reason.

## Acceptance criteria

- [ ] Any authenticated user can submit a product suggestion
- [ ] Admin can list pending suggestions
- [ ] Admin can approve (creates a product) or reject (with reason)
- [ ] User can see the status of their own suggestions
- [ ] Vitest: suggestion lifecycle (submit → pending → approve creates product; reject stores reason)

## Blocked by

04
