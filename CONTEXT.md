# AgriMarket

ตลาดขายตรง ตัดพ่อค้าคนกลาง — ผู้ซื้อประกาศรับซื้อตรง เกษตรกรเสนอขายแข่งราคา ทั้งสองฝ่ายได้ประโยชน์

หลักการ: ตัดพ่อค้าคนกลาง, เกษตรกรกำหนดราคาเอง, ผู้ซื้อจ่ายตรงไม่มีส่วนต่าง, ของสดกว่า ขั้นตอนน้อยลง

## Language

**Demand** (ความต้องการ / ประกาศความต้องการ):
คำประกาศความต้องการซื้อสินค้าเกษตรที่ผู้ซื้อโพสต์ไว้ ยังไม่ใช่คำสั่งซื้อที่ผูกมัดจนกว่าจะจ่ายเงิน
มี quantity (ความต้องการตั้งต้น) และ pending_quantity (ปริมาณที่ยังไม่ได้ match — PENDING/CONFIRMED offers, เปลี่ยนเป็น 0 เมื่อ match)
มี buyer_lat, buyer_lng (พิกัดผู้ซื้อ — ใช้คำนวณระยะทาง Haversine)
MVP: OPEN → MATCHED → COMPLETED (self-pickup, ไม่มี payment ในระบบ)
Phase 2: MATCHED → PAID → PARTIALLY_RECEIVED → COMPLETED (delivery, มี payment + escrow)
_Avoid_: Buy Order, Purchase Order, RFQ, คำสั่งซื้อ, ใบสั่งซื้อ

**Offer** (ข้อเสนอ / ใบเสนอขาย):
คำเสนอขายจากเกษตรกรที่ตอบสนองต่อ Demand ระบุราคา ปริมาณ จุดรับสินค้า วันพร้อมส่ง
1 seller = 1 offer ต่อ 1 Demand (unique)
มี quantity (ปริมาณที่เสนอ) และ accepted_quantity (ปริมาณที่ buyer เลือก — ≤ quantity)
สถานะ: ACTIVE → PENDING_SELLER_CONFIRMATION → CONFIRMED → SELECTED (ล็อค)
สถานะรอง: WITHDRAWN, REJECTED, EXPIRED, CANCELLED, DECLINED
Buyer เลือก → PENDING_SELLER_CONFIRMATION → Seller ยืนยันใน 24 ชม. → CONFIRMED
MVP: CONFIRMED → MATCHED (self-pickup, ระบบให้เบอร์ติดต่อ, ไม่มี payment)
Phase 2: CONFIRMED → SELECTED (delivery, จ่ายผ่านระบบ, ล็อค)
Buyer วนกลับเลือกใหม่ → CONFIRMED กลับเป็น ACTIVE
เมื่อ Demand CANCELLED → ทุก offer (ACTIVE, PENDING, CONFIRMED, SELECTED) → CANCELLED
Counter-offer: ไม่เปลี่ยน state — seller แก้ราคาผ่าน PATCH ได้ตลอด ไม่จำกัดรอบ
Seller เห็น counter-offer ของคู่แข่งเมื่อคู่แข่งยอมรับราคาแล้ว
ถ้า buyer วนกลับเลือกใหม่ → CONFIRMED offers ต้องเลือกใหม่ + ยืนยันใหม่
_Avoid_: Bid, Quote, Proposal

**Transaction** (รายการธุรกรรม) — Phase 2:
เกิดขึ้นเมื่อ buyer เลือก delivery + จ่ายเงินผ่านระบบ — 1 Demand = 1 Transaction
MVP: ไม่มี Transaction (self-pickup, จ่ายกันเอง)
สถานะ: AWAITING_PAYMENT → PAID → COMPLETED / PARTIALLY_REFUNDED / REFUNDED

**TransactionSplit** (ส่วนแบ่งรายผู้ขาย):
แบ่งเงินใน Transaction ตามผู้ขายที่ถูกเลือก — 1 Transaction มีหลาย Split
แต่ละ Split มี escrow ของตัวเอง: AWAITING_PAYMENT → HELD → RELEASED_TO_SELLER / FROZEN / REFUNDED_TO_BUYER

**Escrow** (เงินพักกลาง) — Phase 2:
เงินที่แพลตฟอร์มถือไว้หลัง buyer จ่าย (delivery เท่านั้น) — ปล่อยให้ seller เมื่อยืนยันรับของ
MVP: ไม่มี Escrow (self-pickup)
สถานะต่อ Split: AWAITING_PAYMENT → HELD → RELEASED_TO_SELLER / FROZEN / REFUNDED_TO_BUYER
FROZEN = ถูกล็อคระหว่าง dispute รอ admin ตัดสิน

**Dispute** (ข้อพิพาท) — Phase 2:
Buyer เปิด dispute หลังจ่ายเงินแต่ก่อน COMPLETED — admin ตัดสิน
MVP: ไม่มี Dispute (self-pickup, แก้ปัญหากันเอง)
สถานะ: OPENED → UNDER_REVIEW → RESOLVED_REFUND / RESOLVED_REJECTED
Dispute เปิดที่ Transaction → ทุก split ที่ยัง HELD จะเข้า FROZEN

**ProductSuggestion** (ข้อเสนอสินค้า):
เกษตรกรเสนอสินค้าใหม่ที่ยังไม่มีใน catalog (เช่น "มะระจีน") → admin ตรวจ → approve/reject
status: PENDING / APPROVED / REJECTED

**Follow** (ติดตาม):
ผู้ใช้ติดตามสินค้า (Product) — เมื่อมี Demand ใหม่สำหรับสินค้านั้น → ได้รับ Push + SignalR
Follow ได้ทันทีหลังสมัคร — ไม่ต้องรอ KYC (แต่ยื่น offer ต้อง KYC approved)
เป็นกลไกหลักในการดึง seller เข้าแอป: follow สินค้า → รอ Push → เปิดแอปยื่น offer

**KYC** (การยืนยันตัวตน):
จำเป็นสำหรับ Seller (ยื่น offer) — ส่งรูปบัตรประชาชน + รูปเซลฟี่, admin ตรวจสอบ
1 user มีหลาย submission ได้ (resubmit หลัง reject)

**ProductGrade** (เกรดสินค้า):
เกรดของสินค้าเกษตร — product-specific (ทุเรียน A/B/C, มะม่วง พิเศษ/A/B, ผัก ใหญ่/กลาง/เล็ก)
บางสินค้าไม่มีเกรด = ใช้ "มาตรฐาน". Admin กำหนดเกรดตอนสร้างสินค้า
Seller ระบุเกรดตอนยื่น Offer. MVP: buyer ไม่ระบุเกรดใน Demand → เห็นทุก offer (เกรดเป็น informational)
Hub staff ตรวจเกรดตรงตามที่ seller ระบุ (Phase 2)

**Rider** (ไรเดอร์):
ผู้ขนส่งสินค้า — สมัครแยกจาก seller (ส่งใบขับขี่ + รูปรถ + ทะเบียน), admin ตรวจ
1 user สมัคร rider ได้ (Unified User) แต่ต้อง activate แยก, ใช้ Rider App คนละตัว
Phase 2: hybrid fleet — owned (cold chain), outsourced (ทั่วไป), partner (บริษัทขนส่ง)
หน้าที่: รับของจาก Hub + ส่ง buyer (ไม่ตรวจคุณภาพ — Hub staff ตรวจแล้ว)
Specialization: GENERAL (ทั่วไป) / COLD_CHAIN (รถเย็น). Fragile ใช้ product tag + checklist ในแอป
Training: หลักสูตรออนไลน์ใน Rider App (วิดีโอ + สอบ) → ผ่านก่อนรับงาน
Job assignment: hybrid — ระบบแนะนำ rider ใกล้ + เหมาะสม → Push → rider กดรับ/ปฏิเสธ (30 วิ.) → ปฏิเสธบ่อย = ลด priority
Online/offline: rider เปิด/ปิดรับงานได้ (บังคับ online ถ้ากำลังทำงานอยู่)
Rider App screens: Home (online/offline + รายได้วันนี้ + งานปัจจุบัน), Job Detail (stops + navigation + checklist + shelf_life countdown), Delivery (ที่อยู่ buyer + โทร + ถ่ายรูป), Earnings (รายได้ + สถานะชำระ), History, Profile/Training, Settings
Offline mode: ทุก action เก็บในเครื่อง + sync ทีหลังเมื่อ online. Offline maps ดาวน์โหลดล่วงหน้า. รูปบีบอัดก่อนเก็บ. GPS ทำงานได้ offline

**Delivery** (การขนส่ง):
บริการขนส่งของสด Phase 2 — Hub-based: Seller ส่งของที่ Hub → Hub staff ตรวจคุณภาพ + cold storage → Rider รับจาก Hub → ส่ง buyer
1 Hub ต่อจังหวัด, เปิด 05:00-20:00. Rider รับจาก Hub 1 จุด (ไม่มี multi-stop pickup)
สถานะ Hub: RECEIVED → INSPECTING → PASSED / FAILED
สถานะ Delivery: ASSIGNED → PICKED_UP_FROM_HUB → EN_ROUTE_TO_BUYER → DELIVERED / FAILED / INCIDENT / REJECTED_AT_DELIVERY
Rider ไม่ตรวจคุณภาพ (Hub staff ตรวช) — rider รับ-ส่งเท่านั้น
ค่าขนส่งคำนวณตั้งแต่ Best Offer (ยกเว้น buyer รับเอง), buyer จ่าย, ไม่เข้า escrow
แพลตฟอร์มรับผิดชอบของเสียระหว่างทาง → ไล่สาเหตุทีหลัง
Batching (1 rider หลาย buyer) = Phase 3

## Relationships

- **Demand** 1 รายการ = 1 สินค้า (Product) เท่านั้น
- **Demand** 1 รายการ รองรับหลาย **Offer** จากหลายผู้ขาย (1 seller = 1 offer ต่อ Demand)
- **Demand** 1 รายการ → 1 **Transaction** (เมื่อ seller ยืนยันขาย + buyer จ่ายเงิน)
- **Transaction** 1 รายการ → หลาย **TransactionSplit** (แยกตามผู้ขายที่ถูกเลือก)
- **TransactionSplit** แต่ละรายการ → 1 **Escrow** lifecycle
- **Dispute** เปิดได้ 1 ครั้งต่อ **Transaction** — ระหว่าง dispute, escrow เข้า FROZEN
- **Follow** ผูกกับ Product — ไม่ใช่ Demand หรือ User

## Example dialogue

> **Dev:** "เมื่อ buyer สร้าง Demand มะเขือเทศ 100 กก. แล้วมี 3 offers — buyer จะซื้อได้ยังไง?"
> **Domain expert:** "Buyer ดู offers แล้วต่อราคาได้ — ส่ง counter-offer 22 บาท/กก. ให้ทุกคน เกษตรกรที่ยอมก็แก้ราคาลง เห็นราคากันเองเมื่อยอมรับแล้ว"
> **Dev:** "แล้ว buyer เลือก offers ยังไง?"
> **Domain expert:** "Buyer เลือก offers ที่ต้องการ → offers เป็น PENDING_SELLER_CONFIRMATION → seller ต้องกดยืนยันขายภายใน 24 ชม. ถ้า seller ปฏิเสธ buyer วนกลับเลือกใหม่ได้ พอ seller ยืนยันหมดแล้ว buyer ถึงจ่ายเงิน"
> **Dev:** "แล้ว offer ที่ไม่ถูกเลือก?"
> **Domain expert:** "เปลี่ยนเป็น REJECTED ทันทีเมื่อ buyer จ่ายเงิน — seller ได้รับแจ้งเตือนผ่าน SignalR"
> **Dev:** "หลัง match แล้ว — ยังไงต่อ?"
> **Domain expert:** "MVP: ระบบให้เบอร์โทร → buyer โทรหา seller → นัดรับของ + จ่ายเงินกันเอง → ระบบจบ. Phase 2: ถ้าเลือก delivery → จ่ายผ่านระบบ → เข้า Escrow → rider ส่งของ → ยืนยันรับ → ปล่อยเงินให้ seller"

## Flagged ambiguities

- "Buy Order" เคยใช้หมายถึง Demand — แก้ไขแล้ว: Demand คือประกาศความต้องการก่อนจ่ายเงิน, หลังจ่ายเงินจึงเป็นคำสั่งซื้อที่ผูกมัด
