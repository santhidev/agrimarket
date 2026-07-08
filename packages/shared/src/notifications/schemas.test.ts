import { describe, it, expect } from "vitest";
import { notificationQuerySchema, notificationIdSchema } from "./schemas";

describe("notificationQuerySchema", () => {
  it("applies defaults for empty input", () => {
    expect(notificationQuerySchema.parse({})).toEqual({
      unreadOnly: false,
      limit: 20,
      cursor: undefined,
    });
  });

  it("coerces unreadOnly=true string from query params", () => {
    expect(
      notificationQuerySchema.parse({ unreadOnly: "true" }).unreadOnly
    ).toBe(true);
  });

  it("coerces limit number string", () => {
    expect(notificationQuerySchema.parse({ limit: "5" }).limit).toBe(5);
  });

  it("rejects limit below 1", () => {
    expect(() => notificationQuerySchema.parse({ limit: 0 })).toThrow();
  });

  it("rejects limit above 50", () => {
    expect(() => notificationQuerySchema.parse({ limit: 51 })).toThrow();
  });

  it("rejects non-iso cursor", () => {
    expect(() =>
      notificationQuerySchema.parse({ cursor: "not-a-date" })
    ).toThrow();
  });

  it("accepts a valid iso cursor", () => {
    const iso = "2026-07-08T12:00:00.000Z";
    expect(notificationQuerySchema.parse({ cursor: iso }).cursor).toBe(iso);
  });
});

describe("notificationIdSchema", () => {
  it("accepts a uuid", () => {
    expect(
      notificationIdSchema.parse({ id: "550e8400-e29b-41d4-a716-446655440000" })
    ).toEqual({ id: "550e8400-e29b-41d4-a716-446655440000" });
  });

  it("rejects a non-uuid", () => {
    expect(() => notificationIdSchema.parse({ id: "not-a-uuid" })).toThrow();
  });
});
