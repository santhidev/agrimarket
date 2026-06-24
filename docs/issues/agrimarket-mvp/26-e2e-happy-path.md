Status: ready-for-agent

## What to build

13-step E2E critical path test covering the full MVP flow: register → create product + grades → create demand → register seller + KYC → submit offer with grade → counter-offer → best offer → select → seller confirm → match → auto-complete. Uses xUnit + WebApplicationFactory + SignalR test client.

## Acceptance criteria

- [ ] Step 1: User A registers (OTP 000000)
- [ ] Step 2: Admin creates product "มะเขือเทศ" + grades: A (พิเศษ), B (มาตรฐาน)
- [ ] Step 3: User A creates Demand: 100 กก., +3 days, buyerLat=13.7563, buyerLng=100.5018 → OPEN
- [ ] Step 4: User B registers + KYC → admin approves
- [ ] Step 5: User B submits offer: 25 บาท/กก., 60 กก., เกรด A → ACTIVE
- [ ] Step 6: User C registers + KYC → admin approves
- [ ] Step 7: User C submits offer: 28 บาท/กก., 50 กก., เกรด B → ACTIVE
- [ ] Step 8: User A counter-offer: 22 บาท/กก. → ส่งทุกคน
- [ ] Step 9: User B ยอมรับ 22 บาท → แก้ offer → Seller C เห็นราคา B = 22 บาท
- [ ] Step 10: User A taps "Best Offer" → ranked combinations (B:60kg@22 + C:40kg@28 = 2,640 บาท)
- [ ] Step 11: User A selects B (60 กก.) + C (40 กก.) → PENDING_SELLER_CONFIRMATION
- [ ] Step 12: User B กดยืนยันขาย → CONFIRMED. User C กดปฏิเสธ → DECLINED
- [ ] Step 13: User A เลือก self-pickup → Demand MATCHED → ระบบเปิดเบอร์ B ให้ A → auto COMPLETED หลัง 7 วัน
- [ ] Assert all state transitions, notifications, SignalR events

## Blocked by

23, 24, 25