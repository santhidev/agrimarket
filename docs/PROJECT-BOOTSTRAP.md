# PROJECT BOOTSTRAP — AgriMarket

เอกสารสำหรับ recreate โปรเจ็คใหม่ตั้งแต่ต้น (greenfield)

---

## 1. Product Overview

**AgriMarket** — ตลาดขายตรง ตัดพ่อค้าคนกลาง
- **ปัญหา:** เกษตรกรถูกกดราคาจากพ่อค้าคนกลาง → ขายไม่ได้ราคา, ผู้ซื้อจ่ายแพงเพราะส่วนต่างหลายชั้น
- **วิธีแก้:** ผู้ซื้อประกาศรับซื้อตรง → เกษตรกรเสนอขายแข่งราคา → ตัดคนกลาง, ของสด, ทั้งสองฝ่ายได้ประโยชน์

### หลักการสำคัญ 6 ข้อ
1. **Demand-driven:** คนซื้อประกาศความต้องการ → เกษตรกรเห็นอุปสงค์จริงก่อนผลิต/เก็บเกี่ยว
2. **Competitive Bidding:** เกษตรกรแข่งเสนอราคา เห็นราคากันเอง แก้ราคาได้ตลอด
3. **Unified User:** บัญชีเดียวเป็นได้ทั้งผู้ซื้อและผู้ขาย
4. **Platform as Logistics:** แพลตฟอร์มเป็นธุรกิจขนส่งของสด (Phase 2) — Hub-based: Seller ส่ง Hub → Hub ตรวจ → Rider ส่ง buyer
5. **Escrow + Credit:** ถือเงินก่อนปล่อยเมื่อรับของ + ปล่อยเครดิตให้ผู้ซื้อ
6. **Bulk-first:** เน้นปริมาณมาก (ขายส่ง) ทั่วประเทศ

---

## 2. Architecture

### Solution Structure (Simplified ABP — 27 projects)

```
AgriMarket.sln
├── src/
│   ├── AgriMarket.Domain/                    # Entities: Demand, Offer, User, Product...
│   ├── AgriMarket.Domain.Shared/             # Enums: DemandStatus, OfferStatus...
│   ├── AgriMarket.Application/              # App Services
│   ├── AgriMarket.Application.Contracts/    # DTOs + Interfaces
│   ├── AgriMarket.EntityFrameworkCore/     # DbContext + Repositories
│   ├── AgriMarket.HttpApi.Host/             # Controllers + SignalR Hubs + Startup
│   └── AgriMarket.DbMigrator/               # EF Core migrations
│
├── modules/                                  # 🔴 Deep Modules — แยกเต็ม (5 projects each)
│   ├── Optimization/ (Domain, Application, Contracts, EFCore, HttpApi)
│   └── Escrow/ (Domain, Application, Contracts, EFCore, HttpApi)
│
├── shared/ AgriMarket.Shared/               # DTOs แชร์ Blazor + MAUI
├── web/    AgriMarket.Web/                  # Blazor WASM (buyer/seller)
├── admin/  AgriMarket.Admin/                # Blazor WASM (admin)
├── mobile/ AgriMarket.Maui/                 # .NET MAUI (buyer/seller)
├── rider/  AgriMarket.Rider.Maui/           # .NET MAUI (rider) — Phase 2
└── test/   (5 test projects)
```

Total: 7 (host) + 10 (modules) + 5 (shared/web/admin/mobile/rider) + 5 (test) = 27 projects

### 4 Projects (Monorepo)

| Project | Stack | สำหรับ |
|---------|-------|--------|
| `agri-backend` | ASP.NET Core + ABP Framework (Open Source) + PostgreSQL + Redis + SignalR + Hangfire | API, domain logic |
| `agri-web` | Blazor WASM | Buyers & Sellers (web) |
| `agri-admin` | Blazor WASM | Admin panel |
| `agri-mobile` | .NET MAUI | Buyers, Sellers (mobile) |
| `agri-rider` | .NET MAUI | Riders (mobile) — Phase 2 |

### Tech Stack
- **API Style:** REST + SignalR (real-time)
- **Backend:** ASP.NET Core 10 + ABP Framework (Open Source)
- **Database:** PostgreSQL (primary) + Redis (cache)
- **Background Jobs:** ABP Background Jobs + Hangfire (PostgreSQL storage)
- **Web:** Blazor WASM (agri-web, agri-admin)
- **Mobile:** .NET MAUI (agri-mobile)
- **Infrastructure:** AWS ECS (Docker) + RDS + ElastiCache + S3/CloudFront
- **CI/CD:** GitHub Actions
- **Maps:** Google Maps API (Directions, Distance Matrix, Geocoding) — Phase 2, MVP ใช้ Haversine
- **Payment:** Stripe (PromptPay QR, credit card) — official Stripe.net SDK
- **Push:** Firebase Cloud Messaging (FCM) — FirebaseAdmin .NET SDK
- **Auth:** Phone + OTP → JWT (ต่อยอด ABP Identity, custom PhoneOtpProvider)
- **Language:** i18n-ready, Thai-only MVP

---

## 3. Backend Modules (ABP Framework — Modular Layered)

แต่ละ module แบ่งเป็น layers: Domain, Application, HttpApi — Deep Modules เพิ่ม EntityFrameworkCore

| Module | หน้าที่ | Deep Module |
|--------|--------|-------------|
| **AuthModule** | Phone OTP, JWT | No |
| **UserModule** | Unified profile, credit tier, scores (placeholder) | No |
| **KycModule** | KYC submit, admin review, resubmit | No |
| **CatalogModule** | Product CRUD, product grades, product suggestions, transport profiles | No |
| **DemandModule** | Create/browse/filter Demands, status lifecycle | No |
| **OfferModule** | Submit/edit offers, competitive bidding, SignalR | No |
| **OptimizationEngine** | "Best Offer" algorithm — multi-factor optimization | **Yes** |
| **EscrowEngine** | Payment state machine: hold→split→release→refund (Phase 2) | **Yes** |
| **CreditEngine** | Credit tier lookup, admin กำหนดรายบุคคล (Phase 2) | No |
| **DeliveryModule** | Hub management, rider assignment, fleet (owned + outsourced + partner), delivery from Hub, cold chain (Phase 2) | No |
| **NotificationModule** | Event-driven FCM push, follow-based targeting | No |
| **DisputeModule** | Dispute lifecycle, admin resolution | No |
| **AdminModule** | Dashboard, catalog UI, KYC queue, dispute queue, config | No |

---

## 4. Database Schema (Core Entities)

```sql
users:          id, phone, tier, buyer_score, seller_score, kyc_status, is_admin, is_rider, is_hub_staff, hub_id (nullable), fcm_token (nullable), created_at
products:       id, name, category, unit, requires_cold_chain, is_fragile, shelf_life_hours, is_stackable
product_grades: id, product_id, name, description, sort_order  -- some products may have no grades (use "มาตรฐาน")
demands:        id, buyer_id, product_id, quantity, pending_quantity, deadline, buyer_lat, buyer_lng, status, created_at
offers:         id, demand_id, seller_id, product_grade_id (nullable), price_per_unit, quantity, accepted_quantity (nullable), photos[], pickup_lat, pickup_lng, ready_date, status
transactions:   id, demand_id, buyer_id, total_amount, delivery_fee, credit_percentage, credit_amount, paid_amount, fee_percentage, payment_intent_id, currency, status  -- Phase 2
transaction_splits: id, transaction_id, offer_id, seller_id, amount, escrow_status, released_at (nullable), refunded_at (nullable)  -- Phase 2
deliveries:     id, demand_id, hub_id, rider_id, vehicle_type, requires_cold_chain, status, photos[], delivery_photos[]  -- Phase 2
delivery_stops: id, delivery_id, buyer_id, sequence, estimated_arrival, status (PENDING/DELIVERED/FAILED)  -- Phase 3 (batching)
hubs:           id, name, province, lat, lng, address, phone, operating_hours, has_cold_storage, status (ACTIVE/INACTIVE)  -- Phase 2
hub_receipts:   id, hub_id, demand_id, offer_id, seller_id, received_at, actual_weight, inspection_status (PENDING/PASSED/FAILED), inspection_photos[], inspection_notes (nullable), inspector_id (nullable)  -- Phase 2
disputes:       id, transaction_id, opened_by_user_id, reason (nullable), evidence[], status (OPENED/UNDER_REVIEW/RESOLVED_REFUND/RESOLVED_REJECTED), resolution (RESOLVED_REFUND/RESOLVED_REJECTED), resolution_reason (nullable), resolved_by (nullable), opened_at, resolved_at (nullable)  -- Phase 2
product_suggestions: id, requester_id, name, category, unit, status (PENDING/APPROVED/REJECTED), rejection_reason (nullable), reviewed_by (nullable), submitted_at, reviewed_at (nullable)
notifications:  id, user_id, event_type (DEMAND_NEW/OFFER_NEW/COUNTER_OFFER/SELLER_CONFIRMED/SELLER_DECLINED/STATUS_CHANGED/OFFER_REJECTED/DELIVERY_ASSIGNED/DELIVERY_PICKED_UP/DELIVERY_EN_ROUTE/DELIVERY_DELIVERED/DELIVERY_FAILED/HUB_INSPECTION_FAILED), title, body, data, read_at (nullable)
follows:        id, user_id, product_id
kyc_submissions: id, user_id, id_card_photo, selfie_photo, status (PENDING/APPROVED/REJECTED), rejection_reason (nullable), reviewed_by (nullable), submitted_at, reviewed_at (nullable)
riders:         id, user_id, driver_license_photo, vehicle_photo, vehicle_type, vehicle_plate, specializations[] (GENERAL/COLD_CHAIN), training_status (PENDING/COMPLETED), status (PENDING/APPROVED/REJECTED), is_online, priority_score, decline_count, rejection_reason (nullable), reviewed_by (nullable), submitted_at, reviewed_at (nullable)  -- Phase 2
delivery_partners: id, name, api_key, api_endpoint, vehicle_types[], supports_cold_chain, status (ACTIVE/INACTIVE)  -- Phase 2
```

---

## 5. State Machines

### Demand
```
OPEN → MATCHED → COMPLETED
  ↓      ↓
EXPIRED CANCELLED
```

- Demand อยู่ที่ OPEN ตลอดจนกว่า buyer จะเลือก offers + sellers ยืนยัน → MATCHED
- MATCHED = ระบบให้เบอร์ติดต่อ → buyer กับ seller คุยกันเอง (self-pickup)
- CANCELLED: ยกเลิกได้จาก OPEN หรือ MATCHED, ต้อง notify เกษตรกรทุกคนที่ยืนยัน
- EXPIRED: หมดเขตโดยที่ buyer ไม่เลือก (มี offer หรือไม่มี offer ก็สถานะเดียวกัน)
- COMPLETED: auto หลัง 7 วัน ถ้าไม่มี complaint (Hangfire)
- Phase 2 (delivery): MATCHED → PAID → PARTIALLY_RECEIVED → COMPLETED (มี payment + escrow)

### Offer
```
ACTIVE → PENDING_SELLER_CONFIRMATION (buyer เลือก)
PENDING_SELLER_CONFIRMATION → CONFIRMED (seller ยืนยัน, ภายใน 24 ชม.)
PENDING_SELLER_CONFIRMATION → DECLINED (seller ปฏิเสธ หรือ 24 ชม. หมด)
CONFIRMED → MATCHED (buyer เลือก self-pickup — ระบบให้เบอร์ติดต่อ, ไม่มี payment)
CONFIRMED → SELECTED (buyer เลือก delivery + จ่ายเงิน — ล็อค) — Phase 2
CONFIRMED → ACTIVE (buyer วนกลับเลือกใหม่ — ต้องเลือกใหม่ + seller ยืนยันใหม่)
ACTIVE → REJECTED (buyer จ่ายแล้ว ไม่ได้เลือก หรือ seller ไม่ยืนยัน)
PENDING_SELLER_CONFIRMATION → REJECTED (buyer จ่ายแล้ว ไม่รอ seller confirm)
ACTIVE → WITHDRAWN (เกษตรกรถอนเอง)
ACTIVE → EXPIRED (Demand หมดเขต)
ACTIVE → CANCELLED (Demand ถูกยกเลิก)
PENDING_SELLER_CONFIRMATION → CANCELLED (Demand ถูกยกเลิก)
CONFIRMED → CANCELLED (Demand ถูกยกเลิก)
SELECTED → CANCELLED (Demand ถูกยกเลิก)
```

- SELECTED → ถูกล็อค, แก้ไข/ถอนไม่ได้ (admin เท่านั้นที่ปลดล็อคได้) — Phase 2 เท่านั้น
- MATCHED = สิ้นสุด flow สำหรับ self-pickup (ไม่มี payment, ไม่มี escrow)
- เมื่อ Demand MATCHED (self-pickup) → ทุก offer ที่ไม่ใช่ CONFIRMED เปลี่ยนเป็น REJECTED ทันที
- เมื่อ buyer จ่ายเงิน (delivery, Phase 2) → ทุก offer ที่ไม่ใช่ DECLINED หรือ SELECTED เปลี่ยนเป็น REJECTED ทันที (DECLINED คงสถานะเดิม)
- เมื่อ Demand CANCELLED → ทุก offer (ACTIVE, PENDING_SELLER_CONFIRMATION, CONFIRMED, SELECTED) เปลี่ยนเป็น CANCELLED
- ถ้า buyer วนกลับเลือกใหม่ (หลัง seller ปฏิเสธ) → CONFIRMED offers กลับเป็น ACTIVE, ต้องเลือกใหม่ + seller ยืนยันใหม่
- Counter-offer: ไม่เปลี่ยน state — seller แก้ราคาผ่าน PATCH ได้ตลอด ไม่จำกัดรอบ
- Seller เห็น counter-offer ของคู่แข่งเมื่อคู่แข่งยอมรับราคาแล้ว (เห็นราคาล่าสุดของคู่แข่ง)

### Transaction (Phase 2)
```
AWAITING_PAYMENT → PAID → COMPLETED
                          → PARTIALLY_REFUNDED (1+ splits refunded, 1+ released)
                          → REFUNDED (all splits refunded)
```

### Escrow (Phase 2, per TransactionSplit)
```
AWAITING_PAYMENT → HELD → RELEASED_TO_SELLER
                   ↓
                FROZEN (dispute opened)
                   ↓
          RELEASED_TO_SELLER / REFUNDED_TO_BUYER (admin ตัดสิน)
```

### Dispute (Phase 2)
```
OPENED → UNDER_REVIEW → RESOLVED_REFUND
                       → RESOLVED_REJECTED
```

- Buyer เท่านั้นที่เปิด dispute ได้
- เปิดได้หลัง PAID จนถึงก่อน COMPLETED
- Dispute เปิดที่ Transaction → ทุก split ที่ยัง HELD จะเข้า FROZEN
- MVP: ไม่มี penalty อัตโนมัติ, admin บันทึกคำตัดสินใน resolution
- Phase 2 delivery dispute: ใช้ pickup_photos[] + delivery_photos[] เป็นหลักฐาน. ถ้า rider ผิด (ของดีตอนรับ เสียตอนส่ง) → แพลตฟอร์ม refund buyer จากกระเป๋าตัวเอง, escrow RELEASE ให้ seller. ถ้า seller ผิด (ของเสียตอนรับ) → escrow REFUND ให้ buyer

### Demand ↔ Transaction Status Mapping (Phase 2)
MVP: ไม่มี Transaction (self-pickup)
Phase 2:
- Transaction `paid` → Demand `paid`
- Split แรก released → Demand `partially_received`
- ทุก split resolved (released OR refunded) → Demand `completed`
  - ทุก split released → Transaction `completed`
  - 1+ split refunded + 1+ released → Transaction `partially_refunded`
  - ทุก split refunded → Transaction `refunded`

### Hub Receipt (Phase 2, per seller delivery)
```
RECEIVED → INSPECTING → PASSED (ready for rider) / FAILED (return to seller)
```

- Seller ส่งของที่ Hub เอง (ภายในจังหวัด)
- Hub staff ตรวจคุณภาพ + ชั่งน้ำหนัก (±5% tolerance) + ตรวจเกรดตรงตามที่ seller ระบุ
- PASSED → ของเข้า cold storage (ถ้าต้อง) → รอ rider
- FAILED → คืนของ seller + แจ้ง buyer → วนกลับเลือก seller ใหม่
- Hub เปิด 05:00-20:00

### Delivery (Phase 2)
```
ASSIGNED → PICKED_UP_FROM_HUB → EN_ROUTE_TO_BUYER → DELIVERED
                                       ↓              ↓
                                   INCIDENT       FAILED / REJECTED_AT_DELIVERY
                                       ↓
                                 RESCHEDULED / CANCELLED
```

- ASSIGNED: ระบบจับ rider (จาก Hub)
- PICKED_UP_FROM_HUB: rider รับของจาก Hub (1 จุด)
- EN_ROUTE_TO_BUYER: กำลังส่ง
- DELIVERED: ส่งถึง buyer (ถ่ายรูป delivery_photos[] เป็น proof, ต้องมีคนรับ)
- INCIDENT: รถเสีย/อุบัติเหตุ → admin ตัดสิน RESCHEDULED/CANCELLED
- FAILED: buyer ไม่อยู่ → rider รอ 15 นาที → กลับ Hub → นัดใหม่
- REJECTED_AT_DELIVERY: buyer ปฏิเสธ → rider ถ่ายรูป → auto dispute → ของกลับ Hub
- Rider ไม่ตรวจคุณภาพ (Hub staff ตรวจแล้ว) — rider รับ-ส่งเท่านั้น
- Delivery: rider กด deliver → auto confirm-receipt หลัง 24 ชม. (ถ้าไม่ dispute) → escrow release
- Self-pickup: buyer กด confirm-receipt เหมือนเดิม
- Buyer เลือก delivery หรือ self-pickup ตอน Best Offer. เปลี่ยนใจได้ก่อนจ่ายเงิน

### Delivery Stop (Phase 3 — batching, 1 rider หลาย buyer)
```
PENDING → DELIVERED / FAILED
```

---

## 6. API Contracts (Key Endpoints)

### Auth
- `POST /auth/request-otp` — body: `{ phone }`
- `POST /auth/verify-otp` — body: `{ phone, otp }` → returns `{ access_token, user }`

### KYC
- `POST /kyc/submit` — body: `{ idCardPhoto, selfiePhoto }`
- `GET /admin/kyc/pending`
- `POST /admin/kyc/:id/approve`
- `POST /admin/kyc/:id/reject` — body: `{ reason }`

### Catalog
- `GET /products` — รวม grades ของแต่ละสินค้า
- `GET /products/:id/grades` — รายการเกรดของสินค้า
- `POST /products/suggest` — body: `{ name, category, unit }` — เสนอสินค้าใหม่, admin ตรวจก่อน
- `POST /admin/products` — body: `{ name, category, unit, requiresColdChain, isFragile, shelfLifeHours, isStackable, grades: [{ name, description, sortOrder }] }`
- `GET /admin/products/suggestions` — รายการที่รอตรวจ
- `POST /admin/products/suggestions/:id/approve`
- `POST /admin/products/suggestions/:id/reject` — body: `{ reason }`
- `PATCH /admin/products/:id`
- `POST /admin/products/:id/grades` — body: `{ name, description, sortOrder }` — เพิ่มเกรด
- `PATCH /admin/products/:id/grades/:gradeId`
- `DELETE /admin/products/:id/grades/:gradeId`

### Demand
- `POST /demands` — body: `{ productId, quantity, deadline, buyerLat, buyerLng }` — deadline = วันที่ buyer อยากได้ของ (offer.readyDate ≥ deadline)
- `GET /demands` — query: `productId, status, sort`
- `GET /demands/:id`
- `PATCH /demands/:id/extend` — body: `{ newDeadline }`
- `DELETE /demands/:id`

### Offer
- `POST /demands/:id/offers` — body: `{ pricePerUnit, quantity, productGradeId, photos, pickupLat, pickupLng, readyDate }` — seller ระบุเกรด (ถ้าสินค้ามีเกรด)
- `GET /demands/:id/offers` — แสดงเกรดของแต่ละ offer
- `PATCH /offers/:id` — body: `{ pricePerUnit, quantity, productGradeId, pickupLat, pickupLng, readyDate }`
- `DELETE /offers/:id` — ถอน offer → status WITHDRAWN

### Best Offer
- `POST /demands/:id/best-offer` → returns ranked combinations with cost breakdown

### Select
- `POST /demands/:id/select` — body: `{ selections: [{ offerId, quantity }] }` → offers เป็น PENDING_SELLER_CONFIRMATION, sum(selections.quantity) > 0 และ ≤ demand.quantity

### Counter-Offer
- `POST /demands/:id/counter-offer` — body: `{ pricePerUnit, sellerIds?: [] }` — ไม่ระบุ sellerIds = ส่งทุกคน. Seller เห็น counter ของคู่แข่งเมื่อคู่แข่งยอมรับราคาแล้ว

### Seller Confirmation
- `POST /offers/:id/confirm-sale` — seller ยืนยันขาย → CONFIRMED
- `POST /offers/:id/decline-sale` — seller ปฏิเสธ → DECLINED
- PENDING_SELLER_CONFIRMATION เกิน 24 ชม. → auto DECLINED (Hangfire)

### Match
- `POST /demands/:id/match` — buyer เลือก self-pickup → Demand MATCHED → ระบบเปิดเบอร์โทร seller ให้ buyer

### Payment & Escrow (Phase 2)
- `POST /demands/:id/pay` → returns `{ transaction, paymentIntent, clientSecret }` → จ่ายเฉพาะ CONFIRMED offers → CONFIRMED offers เปลี่ยนเป็น SELECTED
- `POST /webhooks/stripe` — public, processes payment_intent.succeeded
- `POST /transactions/:id/confirm-receipt` — body: `{ split_id }`

### Follow
- `POST /products/:id/follow`
- `DELETE /products/:id/follow`

### Rider (Phase 2)
- `POST /rider/register` — body: `{ driverLicensePhoto, vehiclePhoto, vehicleType, vehiclePlate, specializations }` → สมัคร rider
- `GET /rider/training` — หลักสูตรออนไลน์ (วิดีโอ + สอบ)
- `POST /rider/training/complete` — สอบผ่าน → training_status = COMPLETED → รับงานได้
- `GET /admin/riders/pending`
- `POST /admin/riders/:id/approve`
- `POST /admin/riders/:id/reject` — body: `{ reason }`
- `POST /rider/online` — rider เปิดรับงาน
- `POST /rider/offline` — rider ปิดรับงาน (บังคับ online ถ้ากำลังทำงานอยู่)
- `GET /rider/deliveries` — query: `status` — รายการงานขนส่ง
- `POST /rider/deliveries/:id/accept` — rider กดรับงาน (ภายใน 30 วิ.)
- `POST /rider/deliveries/:id/decline` — rider กดปฏิเสธ (ปฏิเสธบ่อย → ลด priority)
- `GET /rider/earnings` — query: `period` — สรุปรายได้
- `POST /deliveries/:id/pickup` — rider รับของจาก Hub
- `POST /deliveries/:id/deliver` — rider ส่งของ + ถ่ายรูป delivery_photos[]
- `POST /deliveries/:id/reject-delivery` — body: `{ reason, photos }` — buyer ปฏิเสธรับของ → REJECTED_AT_DELIVERY → auto dispute
- `POST /deliveries/:id/failed` — body: `{ reason }` — buyer ไม่อยู่
- `POST /deliveries/:id/incident` — body: `{ type, description, photos }` — รถเสีย/อุบัติเหตุ/จราจร → admin ตัดสิน RESCHEDULED/CANCELLED

### Hub (Phase 2)
- `GET /hubs` — รายการ Hub (เพื่อ seller เลือกส่งของ)
- `POST /hub/receipts` — body: `{ demandId, offerId, sellerId, actualWeight }` — seller ส่งของที่ Hub
- `GET /admin/hub/receipts/pending` — รายการรอตรวจ
- `POST /admin/hub/receipts/:id/inspect` — body: `{ status, notes, photos }` — Hub staff ตรวจคุณภาพ → PASSED/FAILED
- Hub staff ใช้ Admin Panel (Blazor WASM) + `is_hub_staff` flag, 1 Hub = 2-3 staff

### Delivery Tracking (Phase 2)
- `GET /demands/:id/delivery` → `{ status, eta, riderLocation, hubName }` — buyer ติดตาม delivery
- ETA: Haversine Hub→Buyer + 40 km/h (MVP), Google Maps Distance Matrix (Phase 2)
- Buyer ได้รับ FCM Push เมื่อ delivery status เปลี่ยน (PICKED_UP, EN_ROUTE, DELIVERED, FAILED)

### Reviews
- Phase 2 — ไม่อยู่ใน MVP

### Disputes (Phase 2)
- `POST /disputes` — body: `{ transactionId, reason, evidence }`
- `GET /admin/disputes` — query: `status` — รายการ dispute ที่รอตัดสิน
- `POST /admin/disputes/:id/resolve` — body: `{ resolution, reason }`

### Admin
- `GET /admin/dashboard` → `{ total_users, new_users_today, kyc_pending_count, active_demands, demands_created_today, transactions_count_this_month, gmv_this_month, average_demand_value_this_month, demand_fulfillment_rate, transaction_success_rate, repeat_user_rate }`
- `GET /admin/users` — query: `search, kycStatus, tier` — รายการผู้ใช้
- `PATCH /admin/users/:id/credit-tier` — body: `{ tier }` — กำหนด credit tier รายบุคคล

### User
- `GET /users/:id/profile` → `{ user, buyerScore, sellerScore, creditTier }`

### SignalR Hubs (Real-time)
- `OfferHub.NewOffer` — broadcast to buyer (+ FCM Push)
- `OfferHub.OfferUpdated` — broadcast to buyer + competing sellers
- `OfferHub.CounterOffer` — broadcast to sellers (+ FCM Push)
- `OfferHub.SellerConfirmed` — broadcast to buyer (+ FCM Push)
- `OfferHub.SellerDeclined` — broadcast to buyer
- `DemandHub.NewDemand` — broadcast to followers (+ FCM Push)
- `DemandHub.StatusChanged` — broadcast to buyer + selected sellers (+ FCM Push)
- `OfferHub.OfferRejected` — broadcast to rejected sellers (เมื่อ buyer pay)
- `NotificationHub.Push` — server → client
- `DeliveryHub.NewJob` — broadcast to rider (+ FCM Push) — Phase 2
- `DeliveryHub.StatusChanged` — broadcast to buyer (+ FCM Push) + rider — Phase 2
- `DeliveryHub.RejectedAtPickup` — broadcast to buyer + seller — Phase 2
- `DeliveryHub.RiderLocation` — rider GPS → buyer (ทุก 10 วิ., เฉพาะตอน ASSIGNED→DELIVERED) — Phase 2

Push (FCM) ส่งเฉพาะ 7 event: `NewDemand`, `NewOffer`, `CounterOffer`, `SellerConfirmed`, `StatusChanged`, `NewJob` (Phase 2), `DeliveryStatusChanged` (Phase 2)
- `NotificationModule` ใช้ strategy: FCM (ปิดแอป) + SignalR (เปิดแอป)
- `fcm_token` เก็บใน users table, อัปเดตทุกครั้งที่ login

---

## 7. Key Business Rules

- 1 Demand = 1 สินค้าเท่านั้น (เกรดไม่จำกัด — buyer เห็นทุกเกรด)
- สินค้ามีเกรด (product_grades) — product-specific, admin กำหนด. บางสินค้าไม่มีเกรด = ใช้ "มาตรฐาน". Seller ระบุเกรดตอนยื่น offer. MVP: buyer ไม่ระบุเกรดใน Demand → เห็นทุก offer (เกรดเป็น informational tag). Best Offer เรียงตามราคา (เกรด informational ไม่ group by). Phase 2: เพิ่มตัวกรองเกรด
- `pending_quantity` = ปริมาณที่ยังไม่จ่าย (PENDING_SELLER_CONFIRMATION + CONFIRMED offers) — stored field, อัปเดตทุก state change. เปลี่ยนเป็น 0 เมื่อ buyer จ่ายเงิน
- ปริมาณที่จ่ายจริงดูจาก transaction.total_amount และ transaction_splits (derived)
- เมื่อ buyer จ่ายเงิน → ทุก offer ที่ไม่ใช่ DECLINED หรือ SELECTED เปลี่ยนเป็น REJECTED ทันที (DECLINED คงสถานะเดิม), notify ทันที
- Seller เห็นราคา+ชื่อคู่แข่งทั้งหมด (competitive bidding)
- แพลตฟอร์มรับความเสี่ยงเครดิตเต็มจำนวน — Seller ได้เงินเต็มเสมอ
- MVP: Self-Pickup เท่านั้น (ไม่มี Delivery)
- ไม่จำกัดโซน — ทั่วประเทศ
- Unified User: บัญชีเดียว ซื้อก็ได้ ขายก็ได้
- KYC required สำหรับ Seller (submit offer) — Buyer ไม่ต้อง KYC
- KYC admin review SLA: 1-7 วันทำการ
- Follow สินค้าได้ทันทีหลังสมัคร — ไม่ต้องรอ KYC
- Go-to-Market: Seller ก่อน — สมัคร + KYC + Follow สินค้า + รอ Push
- Buyer กลุ่มแรก: คนค้าส่ง/พ่อค้าคนกลาง — volume ใหญ่, ซื้อบ่อย, เข้าใจตลาด. ทีมการตลาดตบ.หา 5-10 รายแรก
- ไม่มี Pre-Offer (MVP): เกษตรกรไม่มีทางประกาศ "มีของพร้อมขาย" — รอ Demand เท่านั้น (Demand-driven)
- Seller ยืนยันขายภายใน 24 ชม. หลังถูกเลือก — เกิน 24 ชม. = auto DECLINED (Hangfire)
- Counter-offer: ไม่จำกัดรอบ, ส่งได้ทุกคนหรือรายตัว, seller เห็น counter ของคู่แข่งเมื่อคู่แข่งยอมรับราคาแล้ว
- 1 seller = 1 offer ต่อ 1 Demand — unique (demand_id, seller_id), แก้ไข offer เดิมแทนส่งใหม่
- `accepted_quantity` = ปริมาณที่ buyer เลือกจาก offer นี้ (≤ quantity)
- 1 user มีหลาย kyc_submissions ได้ (resubmit หลัง reject = record ใหม่)
- เปลี่ยนรูปหลังอนุมัติ: MVP ไม่รองรับ (ติดต่อ admin)
- Admin bootstrap: ABP `IDataSeeder` สร้าง admin จาก `ADMIN_PHONE` env ตอน boot
- `buyer_score` / `seller_score` — placeholder (default 0), ใช้จริง Phase 2
- Test mode OTP: `000000`

### Best Offer MVP Scope
- Algorithm: Bounded Knapsack — เลือก offer ได้ครั้งเดียว, quantity ≤ offer.quantity
- เรียงตามราคารวม (Σ price × qty) จากน้อยไปมาก
- ระยะทางใช้เป็น tiebreaker (ราคาเท่ากัน → เจ้าที่ใกล้กว่ามาก่อน) คำนวณจาก Haversine (40 km/h)
- แสดง combination ที่ดีที่สุดแม้จะไม่ครบตาม demand.quantity
- ไม่มี delivery cost, vehicle selection, split delivery (Phase 1)
- Phase 2: คำนวณค่าขนส่งตั้งแต่หน้า Best Offer — ระยะ Hub→Buyer + ประเภทรถ + cold chain surcharge. แสดงเวลาเดินทาง + ความเสี่ยงของเสีย (ขึ้นกับ shelf_life_hours). ถ้าเวลาเดินทาง ≥ shelf_life → tag "จัดส่งไม่ได้ (ระยะไกล) — กรุณาไปรับเอง". ยกเว้น buyer เลือกไปรับสินค้าด้วยตัวเอง

### Payment & Escrow (Phase 2 — delivery เท่านั้น)
- MVP: ไม่มี payment ในระบบ — self-pickup, buyer จ่าย seller เอง
- Phase 2: Stripe.net SDK — buyer เลือก delivery → จ่ายผ่านระบบ
- 1 Demand = 1 Transaction (idempotent via PaymentIntent)
- `credit_percentage` stub 100% (buyer จ่ายเต็ม) — Credit Engine กำหนดจริงเมื่อเปิดใช้ credit
- `fee_percentage` default 0
- `delivery_fee` = `base_fee + (distance_km × per_km_rate) + (num_stops × stop_fee) + cold_chain_surcharge`. ประเภทรถอัตโนมัติ (MOTORCYCLE/PICKUP/VAN/COLD_VAN/TRUCK). rate กำหนดโดยทีมการเงิน
- Weight tolerance ±5% — rider ชั่งจริง, ถ้าเกิน → ปรับ accepted_quantity อัตโนมัติ
- Refund ผ่าน dispute เท่านั้น
- Escrow = สินค้าอย่างเดียว (seller ได้เต็ม), delivery_fee เป็นรายได้แพลตฟอร์ม (ไม่เข้า escrow)
- Rider payment: outsourced 80% delivery_fee, owned เงินเดือน+โบนัส/trip, partner ตามสัญญา. จ่ายหลัง confirm-receipt

### Credit Engine Rules (Phase 2+)
- Admin/ทีมการตลาดกำหนด credit tier รายบุคคล — ไม่มี algorithm อัตโนมัติ
- MVP: ไม่มี payment → ไม่มี credit. Phase 2: credit_percentage stub 100%. Phase 2+: credit เปิดใช้จริง
- Tier 0 (default / ใหม่): 0% credit → buyer จ่าย 100%
- Tier 1: 20% credit
- Tier 2: 40% credit
- Tier 3: 70% credit
- Platform guarantees seller 100% regardless of buyer credit
- Platform กู้ธนาคารมาค้ำส่วนเครดิต → คิดดอกเบี้ย buyer (MLC + margin)
- ดอกเบี้ยตาม tier: Tier 1 สูงกว่า Tier 3 (เสี่ยงน้อย = ดอกเบี้ยต่ำ)
- ชำระรายเดือน — สิ้นเดือนบวกยอด → ชำระคราวเดียว
- ไม่จ่ายคืน: ลด tier → เครดิต 0% → แบนถ้าไม่จ่าย 3 เดือนติด

---

## 8. MVP Deliverables (9 ข้อ)

1. Product catalog management (Admin) + product suggestions
2. Demand creation, browsing, filtering, following, sharing (deeplink)
3. Offer submission, counter-offer, seller confirmation, competitive bidding, real-time price visibility
4. "Best Offer" button with optimization algorithm
5. Direct contact (phone) after match — self-pickup, ไม่มี payment ในระบบ
6. Push notifications (FCM)
7. KYC submission + manual admin review (SLA 1-7 วันทำการ)
8. Unified user profiles (scores placeholder — Phase 2)
9. Admin dashboard (basic metrics + fulfillment rate + transaction success + repeat rate)

**Phase 2:** Payment (Stripe), Escrow, Hub system (ตรวจคุณภาพ, cold storage), Delivery (rider app, fleet, GPS tracking), Rider onboarding + training, Dispute, Credit engine
- **Phase 2+:** Rider rating (buyer ให้คะแนน rider)

---

## 9. Out of Scope (MVP)

- **Phase 2:** Payment (Stripe + escrow), Hub system (1 ต่อจังหวัด, ตรวจคุณภาพ, cold storage), Delivery (rider app, fleet, GPS tracking), Rider onboarding + training, Dispute system, Credit engine
- **Phase 3:** AI auto-matching, cold chain IoT tracking, market analytics, multi-language, fraud detection

---

## 10. Implementation Order (Dependency Graph)

```
Wave 1:  #1  Scaffolding (solo)
Wave 2:  #2  Auth (solo)
Wave 3:  #3  Catalog + Suggestions  |  #4  KYC  |  #5  Profile   (parallel)
Wave 4:  #6  Demand
Wave 5:  #7  Follow+Notify  |  #8  Offer   (parallel)
Wave 6:  #9  Best Offer
Wave 7:  #10 Select + Seller Confirm + Match + Contact Info
Wave 8:  #11 Admin Dashboard
Wave 9:  #12 E2E Critical Path
```

### Phase 2 (post-MVP)
Hub system + Payment (Stripe) + Escrow + Delivery (rider app, fleet, GPS) + Rider onboarding + training + Dispute + Credit Engine

### Deep Modules (Phase 2 — ต้องการ exhaustive testing)
- 🔴 Optimization Engine (MVP)
- 🔴 Escrow Engine (Phase 2)

---

## 11. Testing Strategy

| Layer | Tool |
|-------|------|
| Backend Unit | xUnit + NSubstitute |
| Backend Integration | xUnit + WebApplicationFactory |
| Backend E2E | xUnit + WebApplicationFactory + SignalR test client |
| Blazor WASM Unit | bUnit |
| Blazor WASM E2E | Playwright |
| MAUI Unit | xUnit |
| MAUI E2E | Appium / MAUI Test |
| Rider MAUI Unit | xUnit — Phase 2 |
| Rider MAUI E2E | Appium / MAUI Test — Phase 2 |

### Critical Path E2E (13 steps)
1. User A registers (OTP)
2. Admin creates product "มะเขือเทศ" + grades: A (พิเศษ), B (มาตรฐาน)
3. User A creates Demand: 100 กก., +3 days, buyerLat=13.7563, buyerLng=100.5018 → status OPEN
4. User B registers + KYC → admin approves
5. User B submits offer: 25 บาท/กก., 60 กก., เกรด A → status ACTIVE
6. User C registers + KYC → admin approves
7. User C submits offer: 28 บาท/กก., 50 กก., เกรด B → status ACTIVE
8. User A counter-offer: 22 บาท/กก. → ส่งทุกคน
9. User B ยอมรับ 22 บาท → แก้ offer → Seller C เห็นราคา B = 22 บาท
10. User A taps "Best Offer" → ranked combinations (B:60kg@22 + C:40kg@28 = 2,640 บาท)
11. User A selects B (60 กก.) + C (40 กก.) → PENDING_SELLER_CONFIRMATION
12. User B กดยืนยันขาย → CONFIRMED. User C กดปฏิเสธ → DECLINED
13. User A เลือก self-pickup → Demand MATCHED → ระบบเปิดเบอร์ B ให้ A → คุยกันเอง → auto COMPLETED หลัง 7 วัน

---

## 12. Key Design Decisions

- **Stripe (Phase 2):** Official Stripe.net SDK — buyer เลือก delivery → จ่ายผ่านระบบ. MVP: ไม่มี payment ในระบบ
- **1 Demand = 1 Transaction (Phase 2):** idempotent via Stripe PaymentIntent. MVP: ไม่มี Transaction
- **Admin bootstrap:** ABP `IDataSeeder` — ไม่มี promotion endpoint
- **GMV ไม่ใช่ revenue:** MVP `fee_percentage = 0` → dashboard แสดง GMV
- **Revenue model:** (1) บริการขนส่ง — Phase 2, Platform as Logistics, premium delivery สำหรับ fresh produce (ตรวจคุณภาพ + cold chain + platform guarantee, ไม่แข่งราคากับรถรับจ้างทั่วไป) (2) ดอกเบี้ยเครดิต — buyer ใช้เครดิต → คิดดอกเบี้ยส่วนที่ platform ค้ำ
- **Delivery model (Phase 2):** Hub-based — Seller ส่งของที่ Hub เอง (1 Hub ต่อจังหวัด, เปิด 05:00-20:00) → Hub staff ตรวจคุณภาพ (±5% tolerance) + cold storage → Rider รับจาก Hub → ส่ง buyer. Hybrid fleet: owned (cold chain, ยอมขาดทุนเพื่อ quality guarantee), outsourced (รายได้หลัก 20% delivery_fee), partner (ตามสัญญา). ไม่มี multi-stop pickup — rider รับจาก Hub 1 จุด. แพลตฟอร์มรับผิดชอบของเสียระหว่างทาง. ค่าขนส่งคำนวณตั้งแต่ Best Offer (ยกเว้น buyer รับเอง). Cold chain: Hub มี cold room, IoT sensor = Phase 3. Rider payment: outsourced 80% delivery_fee, owned เงินเดือน+โบนัส/trip, partner ตามสัญญา. จ่ายหลัง confirm-receipt. Rider ไม่ตรวจคุณภาพ (Hub staff ตรวจ). Training ออนไลน์. Specialization: GENERAL/COLD_CHAIN. Real-time GPS tracking (SignalR, ทุก 10 วิ.). Offline mode (local storage + sync). Batching = Phase 3
- **Haversine distance:** MVP ไม่ใช้ Google Maps — ระยะทางเส้นตรง + ความเร็วเฉลี่ย 40 km/h
- **SignalR real-time:** MAUI ใช้ SignalR .NET Client — ไม่ต้อง polling
- **Per-split release:** แยก release ต่อ seller — notify ทันที ไม่รอคนสุดท้าย
- **Idempotency via state guard:** เช็ค status ก่อนทำ — ไม่มี idempotency key table
- **MVP = Matchmaking only:** Self-pickup → ไม่มี payment ในระบบ → ระบบให้เบอร์ติดต่อ → buyer จ่าย seller เอง. Payment + escrow + dispute = Phase 2 (delivery เท่านั้น)
- **Auto-complete:** Demand MATCHED → auto COMPLETED หลัง 7 วัน (Hangfire), ถ้าไม่มี complaint
- **Seller confirmation timeout:** PENDING_SELLER_CONFIRMATION เกิน 24 ชม. → auto DECLINED (Hangfire)
- **Direct contact after MATCHED:** Buyer กับ seller โทรหากันได้หลัง match (เปิดเบอร์โทร) — สำหรับคุยเรื่องเวลา/จุดรับของ/การจ่ายเงิน
- **Counter-offer:** ไม่จำกัดรอบ, ไม่เปลี่ยน offer state, seller เห็น counter ของคู่แข่งเมื่อยอมรับราคาแล้ว
- **Viral loop:** เกษตรกรชวนกันเองเมื่อ Demand เดียวกัน — แชร์ Demand via deeplink ไป LINE/Facebook, เพื่อนเห็น → สมัคร → ยื่น offer. ไม่มี referral program (MVP)
- **Web KYC limitation:** ส่ง KYC ได้ผ่าน mobile เท่านั้น — web แสดงข้อความให้ใช้แอป
- **Domain language:** Thai สำหรับ user-facing, English สำหรับ code/API

---

## 13. Project Conventions

- **Issue tracking:** `docs/issues/NNN-name.md` + `README.md` index
- **Triage:** `needs-triage` → `needs-info` → `ready-for-agent` / `ready-for-human` / `wontfix`
- **Domain docs:** Single root `CONTEXT.md` (domain glossary + relationships)
- **ADRs:** `docs/adr/`
- **Handoff:** `docs/handoff.md` ต่อท้ายทุก session
- **Commit style:** Imperative mood, ≤50 char subject, blank line, 72-char body wrap
