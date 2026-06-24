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
3. As a user, I want my FCM token registered on login, so that I receive push notifications

### KYC
4. As a seller, I want to submit KYC (ID card photo + selfie), so that I can submit offers
5. As an admin, I want to see pending KYC submissions, so that I can review them
6. As an admin, I want to approve or reject KYC with reason, so that sellers know their status
7. As a seller, I want to resubmit KYC after rejection, so that I can try again
8. As a user, I want to follow products before KYC approval, so that I can receive demand notifications immediately

### Catalog
9. As an admin, I want to create products with grades (e.g., ทุเรียน A/B/C), so that sellers can specify quality
10. As an admin, I want to manage product grades (add/edit/delete), so that the catalog stays accurate
11. As a user, I want to browse products with their grades, so that I know what's available
12. As a seller, I want to suggest a new product, so that I can sell something not in the catalog
13. As an admin, I want to review product suggestions, so that I can approve or reject them

### Demand
14. As a buyer, I want to create a Demand (product, quantity, deadline, location), so that sellers can see my need
15. As a buyer, I want to browse Demands by product/status, so that I can find relevant ones
16. As a buyer, I want to see Demand details with all offers, so that I can evaluate
17. As a buyer, I want to extend my Demand deadline, so that I get more time for offers
18. As a buyer, I want to cancel my Demand, so that I can stop receiving offers
19. As a buyer, I want to share my Demand via deeplink, so that sellers can find it
20. As a buyer, I want my Demand to auto-expire when deadline passes, so that I'm not stuck waiting

### Offer
21. As a seller (KYC approved), I want to submit an offer (price, quantity, grade, photos, location, ready date), so that buyers can consider me
22. As a seller, I want to see competing offers (price + name), so that I can adjust my price competitively
23. As a seller, I want to edit my offer (price, quantity, location, ready date), so that I can stay competitive
24. As a seller, I want to withdraw my offer, so that I can cancel if I change my mind
25. As a seller, I want to see only 1 offer per Demand from me, so that I don't accidentally duplicate

### Counter-Offer
26. As a buyer, I want to send a counter-offer (desired price) to all or specific sellers, so that I can negotiate
27. As a buyer, I want to send unlimited counter-offers, so that I can negotiate until agreement
28. As a seller, I want to see the buyer's counter-offer, so that I can decide to adjust my price
29. As a seller, I want to see competing sellers' prices only after they accept the counter-offer, so that I know the current market price

### Best Offer
30. As a buyer, I want to see ranked offer combinations (Bounded Knapsack), so that I can find the cheapest option
31. As a buyer, I want to see combinations even if they don't fulfill full quantity, so that I know what's possible
32. As a buyer, I want distance as a tiebreaker when prices are equal, so that I get closer sellers first

### Select + Seller Confirmation
33. As a buyer, I want to select offers with quantities, so that sellers know I'm interested
34. As a buyer, I want selected offers to enter PENDING_SELLER_CONFIRMATION, so that sellers must confirm
35. As a seller, I want to confirm sale (within 24h), so that the buyer knows I will deliver
36. As a seller, I want to decline sale, so that the buyer can find other sellers
37. As a buyer, I want to re-select when sellers decline, so that I can find replacements
38. As a buyer, I want pending offers to auto-decline after 24h, so that I'm not stuck waiting

### Match + Contact
39. As a buyer, I want to confirm self-pickup after sellers confirm, so that the Demand is MATCHED
40. As a buyer, I want the system to provide seller's phone number after match, so that I can contact them
41. As a buyer, I want my Demand to auto-complete after 7 days, so that the system cleans up

### Follow + Notifications
42. As a user, I want to follow products, so that I get notified when new Demands appear
43. As a user, I want to unfollow products, so that I stop receiving notifications
44. As a buyer, I want push notification when a new offer arrives, so that I can respond quickly
45. As a buyer, I want push notification when seller confirms/declines, so that I know the status
46. As a seller, I want push notification when a new Demand appears for my followed products, so that I can submit an offer
47. As a seller, I want push notification when I receive a counter-offer, so that I can respond
48. As a buyer, I want real-time updates via SignalR, so that I see offer changes instantly

### Admin
49. As an admin, I want to see dashboard metrics (users, demands, fulfillment rate, transaction success, repeat rate), so that I understand platform health
50. As an admin, I want to search/filter users by KYC status and tier, so that I can manage them
51. As an admin, I want to set credit tier per user, so that I can manage credit (Phase 2 prep)

### User Profile
52. As a user, I want to see my profile (phone, KYC status, credit tier, scores), so that I know my standing
53. As a user, I want to see another user's profile, so that I can evaluate trust

## Implementation Decisions

### Architecture
- **Backend**: ASP.NET Core 10 + ABP Framework (Open Source), Modular Layered
- **Web**: Blazor WASM (agri-web for buyers/sellers, agri-admin for admin)
- **Mobile**: .NET MAUI (agri-mobile for buyers/sellers)
- **Database**: PostgreSQL (primary) + Redis (cache)
- **Background Jobs**: ABP Background Jobs + Hangfire (PostgreSQL storage)
- **Real-time**: SignalR (hubs for offer/demand/notification events)
- **Push**: Firebase Cloud Messaging (FCM) via FirebaseAdmin .NET SDK
- **Auth**: Phone + OTP → JWT (ต่อยอด ABP Identity, custom PhoneOtpProvider)
- **Solution**: 27 projects — 7 host + 10 deep modules + 5 frontend + 5 test
- **Test OTP**: `000000`

### Schema (MVP)
- `users` — id, phone, tier, buyer_score, seller_score, kyc_status, is_admin, is_rider, is_hub_staff, hub_id, fcm_token, created_at
- `products` — id, name, category, unit, requires_cold_chain, is_fragile, shelf_life_hours, is_stackable
- `product_grades` — id, product_id, name, description, sort_order
- `demands` — id, buyer_id, product_id, quantity, pending_quantity, deadline, buyer_lat, buyer_lng, status, created_at
- `offers` — id, demand_id, seller_id, product_grade_id, price_per_unit, quantity, accepted_quantity, photos[], pickup_lat, pickup_lng, ready_date, status
- `notifications` — id, user_id, event_type, title, body, data, read_at
- `follows` — id, user_id, product_id
- `kyc_submissions` — id, user_id, id_card_photo, selfie_photo, status, rejection_reason, reviewed_by, submitted_at, reviewed_at
- `product_suggestions` — id, requester_id, name, category, unit, status, rejection_reason, reviewed_by, submitted_at, reviewed_at

### State Machines
- **Demand**: OPEN → MATCHED → COMPLETED (หรือ EXPIRED / CANCELLED). Auto-complete 7 วัน (Hangfire). Auto-expire ตาม deadline (Hangfire ตรวจทุก 5 นาที)
- **Offer**: ACTIVE → PENDING_SELLER_CONFIRMATION → CONFIRMED → MATCHED (self-pickup). รอง: WITHDRAWN, REJECTED, EXPIRED, CANCELLED, DECLINED. CONFIRMED → ACTIVE (วนกลับเลือกใหม่). Auto-decline 24 ชม. (Hangfire)

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
- `buyer_score` / `seller_score` — placeholder (default 0), ใช้จริง Phase 2
- Admin bootstrap: ABP `IDataSeeder` สร้าง admin จาก `ADMIN_PHONE` env

### SignalR Hubs
- `OfferHub.NewOffer` — broadcast to buyer (+ FCM Push)
- `OfferHub.OfferUpdated` — broadcast to buyer + competing sellers
- `OfferHub.CounterOffer` — broadcast to sellers (+ FCM Push)
- `OfferHub.SellerConfirmed` — broadcast to buyer (+ FCM Push)
- `OfferHub.SellerDeclined` — broadcast to buyer
- `DemandHub.NewDemand` — broadcast to followers (+ FCM Push)
- `DemandHub.StatusChanged` — broadcast to buyer + selected sellers (+ FCM Push)
- `OfferHub.OfferRejected` — broadcast to rejected sellers (เมื่อ Demand MATCHED)
- `NotificationHub.Push` — server → client

### API Contracts (Key Endpoints)
- Auth: request-otp, verify-otp
- KYC: submit, admin pending/approve/reject
- Catalog: GET products, GET grades, suggest, admin products CRUD + grades CRUD + suggestions review
- Demand: POST (with buyerLat/buyerLng), GET (filter), GET/:id, PATCH extend, DELETE
- Offer: POST (with gradeId), GET, PATCH, DELETE
- Best Offer: POST /demands/:id/best-offer
- Select: POST /demands/:id/select
- Counter-Offer: POST /demands/:id/counter-offer
- Seller Confirmation: POST /offers/:id/confirm-sale, POST /offers/:id/decline-sale
- Match: POST /demands/:id/match
- Follow: POST/DELETE /products/:id/follow
- Admin: GET dashboard (with metrics), GET users, PATCH credit-tier
- User: GET /users/:id/profile

## Testing Decisions

### Testing Strategy
- **Backend Unit**: xUnit + NSubstitute — ทุก module ต้องมี unit tests
- **Backend Integration**: xUnit + WebApplicationFactory — ทุก API endpoint
- **Backend E2E**: xUnit + WebApplicationFactory + SignalR test client — critical path
- **Blazor WASM Unit**: bUnit — component tests
- **Blazor WASM E2E**: Playwright — web + admin
- **MAUI Unit**: xUnit — view model tests
- **MAUI E2E**: Appium / MAUI Test

### ทุก Module ต้องเขียน Test เป็นพิเศษ

| Module | Test Focus |
|--------|-----------|
| **AuthModule** | OTP request/verify, JWT generation, token refresh, test mode `000000` |
| **UserModule** | Profile CRUD, credit tier lookup, score placeholder |
| **KycModule** | Submit, admin approve/reject, resubmit, status transitions, SLA tracking |
| **CatalogModule** | Product CRUD, grades CRUD, suggestions submit/review, validation |
| **DemandModule** | Create, browse, filter, extend, cancel, auto-expire (Hangfire), auto-complete (Hangfire) |
| **OfferModule** | Submit, edit, withdraw, unique constraint, counter-offer, seller confirm/decline, auto-decline (Hangfire) |
| **OptimizationEngine** | Bounded Knapsack algorithm, tiebreaker (distance), partial fulfillment, edge cases (0 offers, 1 offer, over quantity) — **exhaustive testing** |
| **NotificationModule** | FCM push, SignalR strategy, event routing, read tracking |
| **AdminModule** | Dashboard metrics calculation, user search/filter, credit tier update |

### What makes a good test
- Test external behavior (API contracts, state transitions), not implementation details
- Test edge cases: empty state, boundary values, concurrent operations
- Test state machine transitions: valid + invalid transitions
- Test Hangfire jobs: auto-expire, auto-complete, auto-decline
- Test SignalR: hub events broadcast to correct recipients

## Out of Scope

- **Phase 2:** Payment (Stripe + escrow), Hub system (1 ต่อจังหวัด, ตรวจคุณภาพ, cold storage), Delivery (rider app, fleet, GPS tracking), Rider onboarding + training, Dispute system, Credit engine
- **Phase 2+:** Rider rating, Credit interest (bank loan, monthly billing)
- **Phase 3:** AI auto-matching, cold chain IoT tracking, market analytics, multi-language, fraud detection, delivery batching (1 rider หลาย buyer)

## Further Notes

- Go-to-Market: Seller ก่อน — สมัคร + KYC + Follow สินค้า + รอ Push. Buyer กลุ่มแรก: คนค้าส่ง/พ่อค้าคนกลาง (ทีมการตลาดตบ.หา 5-10 รายแรก)
- Viral loop: แชร์ Demand via deeplink ไป LINE/Facebook, ไม่มี referral program (MVP)
- Retention: Follow + Push เป็น retention mechanism หลัก
- Competitive bidding: seller เห็นราคากัน — race to the bottom เป็น market efficiency ไม่ใช่ปัญหา
- Product grades: product-specific (ไม่ใช่สากล), บางสินค้าไม่มีเกรด = "มาตรฐาน"
- Weight tolerance: ±5% (Phase 2 เมื่อมี Hub staff ชั่ง)
- Direct contact after MATCHED: เปิดเบอร์โทร — buyer กับ seller คุยเรื่องเวลา/จุดรับของ/การจ่ายเงิน
- Domain language: Thai สำหรับ user-facing, English สำหรับ code/API

Status: ready-for-agent