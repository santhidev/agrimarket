Status: ready-for-agent

## What to build

Admin dashboard with metrics: total_users, new_users_today, kyc_pending_count, active_demands, demands_created_today, gmv_this_month, average_demand_value_this_month, demand_fulfillment_rate, transaction_success_rate, repeat_user_rate. Admin Blazor WASM dashboard UI with charts/tables.

## Acceptance criteria

- [ ] GET /admin/dashboard returns all metrics in one call
- [ ] demand_fulfillment_rate = % demands with at least 1 offer
- [ ] transaction_success_rate = % matched demands that reach COMPLETED
- [ ] repeat_user_rate = % users with 2+ demands or 2+ offers
- [ ] Admin UI: dashboard with metric cards + charts
- [ ] Admin UI: metrics auto-refresh
- [ ] Unit tests: each metric calculation with mock data
- [ ] Integration test: dashboard with seeded data

## Blocked by

21