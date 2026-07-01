# PRD — AgriMarket MVP

## Problem Statement

เกษตรกรถูกกดราคาจากพ่อค้าคนกลาง — ขายไม่ได้ราคา, ผู้ซื้อจ่ายแพงเพราะส่วนต่างหลายชั้น ระบบปัจจุบันบังคับให้เกษตรกรโพสต์ขายก่อนแล้วรอคนซื้อ ทำให้ไม่มีอำนาจต่อรองและถูกกดราคา

## Solution

แพลตฟอร์มจับคู่ (matchmaking) — ผู้ซื้อประกาศรับซื้อตรง (Demand) → เกษตรกรเสนอขายแข่งราคา (Offer + Counter-offer) → ผู้ซื้อเลือก → เกษตรกรยืนยันขาย → ระบบให้เบอร์ติดต่อ → คุยกันเอง (self-pickup, ไม่มีเงินในระบบ)

MVP เป็น matchmaking platform ล้วน — ไม่มี payment, ไม่มี escrow, ไม่มี delivery. Payment + escrow + delivery เป็น Phase 2

## User Stories

### Auth
1. As a new user, I want to register with phone + OTP, so that I can access the platform
2. As a user, I want to login with phone + OTP, so that I can use the app
3. As a user, I want my session persisted, so that I stay logged in across reloads
4. As a user, I want to log out, so that I can end my session

### KYC
5. As a seller, I want to submit KYC (ID card photo + selfie), so that I can submit offers
6. As an admin, I want to see pending KYC submissions, so that I can review them
7. As an admin, I want to approve or reject KYC with reason, so that sellers know their status
8. As a seller, I want to resubmit KYC after rejection, so that I can try again
9. As a user, I want to follow products before KYC approval, so that I can receive demand notifications immediately

### Catalog
10. As an admin, I want to create products with grades (e.g., ทุเรียน A/B/C), so that sellers can specify quality
11. As an admin, I want to manage product grades (add/edit/delete), so that the catalog stays accurate
12. As a user, I want to browse products with their grades, so that I know what's available
13. As a seller, I want to suggest a new product, so that I can sell something not in the catalog
14. As an admin, I want to review product suggestions, so that I can approve or reject them

### Demand
15. As a buyer, I want to create a Demand (product, quantity, deadline, location), so that sellers can see my need
16. As a buyer, I want to browse Demands by product/status, so that I can find relevant ones
17. As a buyer, I want to see Demand details with all offers, so that I can evaluate
18. As a buyer, I want to extend my Demand deadline, so that I get more time for offers
19. As a buyer, I want to cancel my Demand, so that I can stop receiving offers
20. As a buyer, I want to share my Demand via deeplink, so that sellers can find it
21. As a buyer, I want my Demand to auto-expire when deadline passes, so that I'm not stuck waiting

### Offer
22. As a seller (KYC approved), I want to submit an offer (price, quantity, grade, photos, location, ready date), so that buyers can consider me
23. As a seller, I want to see competing offers (price + name), so that I can adjust my price competitively
24. As a seller, I want to edit my offer (price, quantity, location, ready date), so that I can stay competitive
25. As a seller, I want to withdraw my offer, so that I can cancel if I change my mind
26. As a seller, I want to see only 1 offer per Demand from me, so that I don't accidentally duplicate

### Counter-Offer
27. As a buyer, I want to send a counter-offer (desired price) to all or specific sellers, so that I can negotiate
28. As a buyer, I want to send unlimited counter-offers, so that I can negotiate until agreement
29. As a seller, I want to see the buyer's counter-offer, so that I can decide to adjust my price
30. As a seller, I want to see competing sellers' prices only after they accept the counter-offer, so that I know the current market price

### Best Offer
31. As a buyer, I want to see ranked offer combinations (Bounded Knapsack), so that I can find the cheapest option
32. As a buyer, I want to see combinations even if they don't fulfill full quantity, so that I know what's possible
33. As a buyer, I want distance as a tiebreaker when prices are equal, so that I get closer sellers first

### Select + Seller Confirmation
34. As a buyer, I want to select offers with quantities, so that sellers know I'm interested
35. As a buyer, I want selected offers to enter PENDING_SELLER_CONFIRMATION, so that sellers must confirm
36. As a seller, I want to confirm sale (within 24h), so that the buyer knows I will deliver
37. As a seller, I want to decline sale, so that the buyer can find other sellers
38. As a buyer, I want to re-select when sellers decline, so that I can find replacements
39. As a buyer, I want pending offers to auto-decline after 24h, so that I'm not stuck waiting

### Match + Contact
40. As a buyer, I want to confirm self-pickup after sellers confirm, so that the Demand is MATCHED
41. As a buyer, I want the system to provide seller's phone number after match, so that I can contact them
42. As a buyer, I want my Demand to auto-complete after 7 days, so that the system cleans up

### Follow + Notifications
43. As a user, I want to follow products, so that I get notified when new Demands appear
44. As a user, I want to unfollow products, so that I stop receiving notifications
45. As a buyer, I want push notification when a new offer arrives, so that I can respond quickly
46. As a buyer, I want push notification when seller confirms/declines, so that I know the status
47. As a seller, I want push notification when a new Demand appears for my followed products, so that I can submit an offer
48. As a seller, I want push notification when I receive a counter-offer, so that I can respond
49. As a buyer, I want real-time updates, so that I see offer changes instantly

### Admin
50. As an admin, I want to see dashboard metrics (users, demands, fulfillment rate, transaction success, repeat rate), so that I understand platform health
51. As an admin, I want to search/filter users by KYC status and tier, so that I can manage them
52. As an admin, I want to set credit tier per user, so that I can manage credit (Phase 2 prep)

### User Profile
53. As a user, I want to see my profile (phone, KYC status, credit tier, scores), so that I know my standing
54. As a user, I want to see another user's profile, so that I can evaluate trust

## Implementation Decisions

### Architecture
- **Monorepo**: Turborepo + pnpm workspaces — `apps/web` (Next.js full-stack), `apps/mobile` (Expo, deferred), `packages/database` (Prisma), `packages/shared` (zod + types + logic), `packages/ui` (shared RNW, later)
- **Web + API**: Next.js 15 App Router (RSC by default, `'use client'` where interactivity needs it). API lives in `app/api/*/route.ts`
- **ORM**: Prisma + PostgreSQL. Single `schema.prisma` source of truth in `packages/database`, migrations via `prisma migrate dev`
- **Validation**: zod schemas in `packages/shared` — shared between API (request validation) and client (form validation), single source of truth
- **Auth**: Auth.js (NextAuth) with a custom Credentials provider implementing phone-OTP (`requestOtp` + `verifyOtp` callbacks), JWT session strategy
- **Cache/Jobs**: Redis (existing docker-compose) for session/OTP store + BullMQ for auto-expire/auto-complete/auto-decline jobs
- **Realtime**: Socket.io or SSE for offer/demand updates (single seam through Next.js API)
- **Test OTP**: `000000`
- See [ADR 0001](../../adr/0001-stack-migration-to-nextjs-expo.md) and [ADR 0002](../../adr/0002-glossary-stack.md)

### Schema (MVP)
Postgres tables (snake_case via Prisma `@@map`):
- `users` — id, phone, tier, buyer_score, seller_score, kyc_status, is_admin, is_rider, is_hub_staff, hub_id, created_at
- `products` — id, name, category, unit, requires_cold_chain, is_fragile, shelf_life_hours, is_stackable
- `product_grades` — id, product_id, name, description, sort_order
- `demands` — id, buyer_id, product_id, quantity, pending_quantity, deadline, buyer_lat, buyer_lng, status, created_at
- `offers` — id, demand_id, seller_id, product_grade_id, price_per_unit, quantity, accepted_quantity, photos[], pickup_lat, pickup_lng, ready_date, status
- `notifications` — id, user_id, event_type, title, body, data, read_at
- `follows` — id, user_id, product_id
- `kyc_submissions` — id, user_id, id_card_photo, selfie_photo, status, rejection_reason, reviewed_by, submitted_at, reviewed_at
- `product_suggestions` — id, requester_id, name, category, unit, status, rejection_reason, reviewed_by, submitted_at, reviewed_at

### State Machines
- **Demand**: OPEN → MATCHED → COMPLETED (หรือ EXPIRED / CANCELLED). Auto-complete 7 วัน (BullMQ). Auto-expire ตาม deadline (BullMQ ตรวจทุก 5 นาที)
- **Offer**: ACTIVE → PENDING_SELLER_CONFIRMATION → CONFIRMED → MATCHED (self-pickup). รอง: WITHDRAWN, REJECTED, EXPIRED, CANCELLED, DECLINED. CONFIRMED → ACTIVE (วนกลับเลือกใหม่). Auto-decline 24 ชม. (BullMQ)

### Business Rules
- 1 Demand = 1 สินค้า (เกรดไม่จำกัด — buyer เห็นทุกเกรด, เกรดเป็น informational)
- 1 seller = 1 offer ต่อ Demand (unique demand_id + seller_id)
- Confirm (select): sum(quantity) > 0 และ ≤ demand.quantity
- Counter-offer: ไม่จำกัดรอบ, ไม่เปลี่ยน offer state, seller เห็น counter ของคู่แข่งเมื่อยอมรับแล้ว
- Seller ยืนยันขายใน 24 ชม. → เกิน = auto DECLINED
- MVP: ไม่มี payment ในระบบ — self-pickup, buyer จ่าย seller เอง
- MATCHED = ระบบให้เบอร์ติดต่อ → buyer กับ seller คุยกันเอง
- Best Offer: Bounded Knapsack, เรียงตามราคารวม, ระยะทางเป็น tiebreaker (Haversine 40 km/h)
- KYC required สำหรับ submit offer — Buyer ไม่ต้อง KYC
- KYC admin review SLA: 1-7 วันทำการ
- Follow ได้ทันทีหลังสมัคร — ไม่ต้องรอ KYC
- Go-to-Market: Seller ก่อน — สมัคร + KYC + Follow + รอ Push
- ไม่มี Pre-Offer — รอ Demand เท่านั้น (Demand-driven)

### Realtime
- New offer on a Demand → buyer notified (+ push)
- Seller confirm/decline → buyer notified (+ push)
- New Demand for followed product → followers notified (+ push)
- Counter-offer received → seller notified (+ push)

### API Contracts (Key Endpoints)
Next.js API Routes under `app/api/`:
- Auth: `POST /api/auth/request-otp`, `POST /api/auth/verify-otp` (via Auth.js provider callbacks)
- KYC: `POST /api/kyc`, `GET /api/admin/kyc/pending`, `POST /api/admin/kyc/:id/approve|reject`
- Catalog: `GET /api/products`, `GET /api/products/:id/grades`, `POST /api/product-suggestions`, admin products/grades/suggestions CRUD
- Demand: `POST /api/demands`, `GET /api/demands`, `GET /api/demands/:id`, `PATCH /api/demands/:id`, `DELETE /api/demands/:id`
- Offer: `POST /api/offers`, `GET /api/demands/:id/offers`, `PATCH /api/offers/:id`, `DELETE /api/offers/:id`
- Best Offer: `POST /api/demands/:id/best-offer`
- Select: `POST /api/demands/:id/select`
- Counter-Offer: `POST /api/demands/:id/counter-offer`
- Seller Confirmation: `POST /api/offers/:id/confirm-sale`, `POST /api/offers/:id/decline-sale`
- Match: `POST /api/demands/:id/match`
- Follow: `POST /api/products/:id/follow`, `DELETE /api/products/:id/follow`
- Admin: `GET /api/admin/dashboard`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/credit-tier`
- User: `GET /api/users/:id/profile`

## Testing Decisions

### Test Seams (3 layers)
1. **Vitest** (`packages/shared`, `apps/web`) — pure logic unit/integration: Bounded Knapsack solver, Demand/Offer state machines, zod schemas, Haversine, Prisma queries against a test Postgres (testcontainers or a dedicated test DB)
2. **MSW** (`apps/web`) — component/API mock layer: React component tests with mocked API responses, isolating UI from backend for fast feedback
3. **Playwright** (`apps/web`) — full-stack E2E: real browser driving the Next.js app against real Postgres + Redis, covering the critical paths (register → KYC → Demand → Offer → Best Offer → Select → Confirm → Match)

### ทุก Module ต้องเขียน Test เป็นพิเศษ

| Module | Test Focus |
|--------|-----------|
| **Auth** | OTP request/verify, Auth.js session, test mode `000000` |
| **User/Profile** | Profile CRUD, credit tier lookup, score placeholder |
| **KYC** | Submit, admin approve/reject, resubmit, status transitions, SLA tracking |
| **Catalog** | Product CRUD, grades CRUD, suggestions submit/review, validation |
| **Demand** | Create, browse, filter, extend, cancel, auto-expire (BullMQ), auto-complete (BullMQ) |
| **Offer** | Submit, edit, withdraw, unique constraint, counter-offer, seller confirm/decline, auto-decline (BullMQ) |
| **Best Offer (OptimizationEngine)** | Bounded Knapsack algorithm, tiebreaker (distance), partial fulfillment, edge cases (0 offers, 1 offer, over quantity) — **exhaustive testing** |
| **Notifications** | Event routing, read tracking, realtime delivery |
| **Admin** | Dashboard metrics calculation, user search/filter, credit tier update |

### What makes a good test
- Test external behavior (API contracts, state transitions), not implementation details
- Test edge cases: empty state, boundary values, concurrent operations
- Test state machine transitions: valid + invalid transitions
- Test BullMQ jobs: auto-expire, auto-complete, auto-decline
- Test realtime: events broadcast to correct recipients

## Out of Scope

- **Phase 2:** Payment (Stripe + escrow), Hub system, Delivery (rider app, fleet, GPS tracking), Rider onboarding + training, Dispute system, Credit engine
- **Phase 2+:** Rider rating, Credit interest (bank loan, monthly billing)
- **Phase 3:** AI auto-matching, cold chain IoT tracking, market analytics, multi-language, fraud detection, delivery batching
- **Expo mobile app:** deferred until web is stable (separate PRD/issues when ready)

## Further Notes

- Go-to-Market: Seller ก่อน — สมัคร + KYC + Follow สินค้า + รอ Push. Buyer กลุ่มแรก: คนค้าส่ง/พ่อค้าคนกลาง
- Viral loop: แชร์ Demand via deeplink ไป LINE/Facebook, ไม่มี referral program (MVP)
- Retention: Follow + Push เป็น retention mechanism หลัก
- Competitive bidding: seller เห็นราคากัน — race to the bottom เป็น market efficiency ไม่ใช่ปัญหา
- Product grades: product-specific (ไม่ใช่สากล), บางสินค้าไม่มีเกรด = "มาตรฐาน"
- Direct contact after MATCHED: เปิดเบอร์โทร — buyer กับ seller คุยเรื่องเวลา/จุดรับของ/การจ่ายเงิน
- Domain language: Thai สำหรับ user-facing, English สำหรับ code/API

Status: ready-for-agent
