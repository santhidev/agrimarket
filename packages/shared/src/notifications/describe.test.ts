import { describe, it, expect } from "vitest";
import { describeNotification } from "./describe";
import {
  NotificationType as NotificationTypeEnum,
  type NotificationType,
} from "./types";

describe("describeNotification", () => {
  it("returns title + body for offer.created", () => {
    expect(
      describeNotification(NotificationTypeEnum.OfferCreated, {
        productName: "มะม่วงน้ำดอกไม้",
      })
    ).toEqual({
      title: "มีข้อเสนอใหม่",
      body: "คุณมีข้อเสนอใหม่บนประกาศ มะม่วงน้ำดอกไม้",
    });
  });

  it("returns title + body for offer.seller_confirmed", () => {
    expect(
      describeNotification(NotificationTypeEnum.OfferSellerConfirmed, {
        productName: "ทุเรียน",
      })
    ).toEqual({
      title: "เกษตรกรยืนยันการขาย",
      body: "เกษตรกรยืนยันข้อเสนอบนประกาศ ทุเรียน",
    });
  });

  it("returns title + body for offer.seller_declined", () => {
    expect(
      describeNotification(NotificationTypeEnum.OfferSellerDeclined, {
        productName: "ทุเรียน",
      })
    ).toEqual({
      title: "เกษตรกรปฏิเสธการขาย",
      body: "เกษตรกรปฏิเสธข้อเสนอบนประกาศ ทุเรียน",
    });
  });

  it("returns title + body for demand.created (with quantity + unit)", () => {
    expect(
      describeNotification(NotificationTypeEnum.DemandCreated, {
        productName: "มะม่วง",
        quantity: 100,
        unit: "กก.",
      })
    ).toEqual({
      title: "มีประกาศรับซื้อใหม่",
      body: "มีคนรับซื้อ มะม่วง 100 กก.",
    });
  });

  it("returns title + body for counter_offer.received", () => {
    expect(
      describeNotification(NotificationTypeEnum.CounterOfferReceived, {
        productName: "มะม่วง",
        price: 80,
        unit: "กก.",
      })
    ).toEqual({
      title: "ผู้ซื้อส่งข้อเสนอกลับ",
      body: "ผู้ซื้อต้องการ มะม่วง ที่ราคา 80 บาท/กก.",
    });
  });

  it("returns title + body for demand.expired", () => {
    expect(
      describeNotification(NotificationTypeEnum.DemandExpired, {
        productName: "มะม่วง",
      })
    ).toEqual({
      title: "ประกาศหมดอายุ",
      body: "ประกาศ มะม่วง หมดอายุแล้ว",
    });
  });

  it("returns title + body for demand.completed", () => {
    expect(
      describeNotification(NotificationTypeEnum.DemandCompleted, {
        productName: "มะม่วง",
      })
    ).toEqual({
      title: "ประกาศเสร็จสิ้น",
      body: "ประกาศ มะม่วง เสร็จสิ้นแล้ว",
    });
  });

  it("returns title + body for offer.auto_declined", () => {
    expect(
      describeNotification(NotificationTypeEnum.OfferAutoDeclined, {
        productName: "มะม่วง",
      })
    ).toEqual({
      title: "ข้อเสนอหมดเวลา",
      body: "ข้อเสนอของคุณบน มะม่วง ถูกปฏิเสธอัตโนมัติ (เกิน 24 ชม.)",
    });
  });

  it("falls back to placeholder when payload field is missing", () => {
    expect(
      describeNotification(NotificationTypeEnum.OfferCreated, {})
    ).toEqual({
      title: "มีข้อเสนอใหม่",
      body: "คุณมีข้อเสนอใหม่บนประกาศ —",
    });
  });

  it("returns default for unknown type", () => {
    expect(
      describeNotification("unknown.type" as NotificationType, {})
    ).toEqual({
      title: "การแจ้งเตือน",
      body: "",
    });
  });
});
