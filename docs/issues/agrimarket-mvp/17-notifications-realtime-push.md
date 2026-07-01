Status: ready-for-agent

## What to build

Notifications foundation: an event bus + a `notifications` table (user_id, event_type, title, body, data, read_at) + realtime delivery (Socket.io or SSE) + a list endpoint (`GET /api/notifications`, `POST /api/notifications/:id/read`). Wire the events emitted by earlier issues: new offer on a demand → buyer; seller confirm/decline → buyer; new demand for a followed product → followers; counter-offer received → sellers. Push (FCM/web push) is a stub for MVP — log only; the realtime channel is the live path.

## Acceptance criteria

- [ ] Domain events (offer-created, seller-confirmed/declined, demand-created, counter-offer) are caught and turned into `notifications` rows for the right recipients
- [ ] `GET /api/notifications` lists a user's notifications; `POST /api/notifications/:id/read` marks read
- [ ] Realtime channel pushes new notifications to the connected user
- [ ] New Demand for a followed product notifies followers (consumes 16)
- [ ] Vitest: event → notification mapping per recipient; read marking

## Blocked by

16
