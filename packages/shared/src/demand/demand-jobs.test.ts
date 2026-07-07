import { describe, it, expect } from "vitest";
import {
  shouldExpireDemand,
  shouldCompleteDemand,
  COMPLETE_AFTER_MS,
} from "./demand-jobs";
import { DemandStatus } from "./enums";

// shouldExpireDemand (Issue 09): the recurring expire job finds OPEN demands
// whose deadline has passed and flips them to EXPIRED. The route does the
// coarse filter in SQL; this predicate is the pure re-check each candidate row
// must pass before UPDATE, so a race (buyer extended deadline between SELECT
// and UPDATE) is skipped and every tick stays idempotent.
describe("shouldExpireDemand", () => {
  it("expires an OPEN demand whose deadline is in the past", () => {
    const now = new Date("2026-07-07T12:00:00.000Z");
    expect(
      shouldExpireDemand(
        { status: DemandStatus.Open, deadline: "2026-07-07T11:00:00.000Z" },
        now
      )
    ).toBe(true);
  });

  it("does not expire an OPEN demand whose deadline is still in the future", () => {
    const now = new Date("2026-07-07T12:00:00.000Z");
    expect(
      shouldExpireDemand(
        { status: DemandStatus.Open, deadline: "2026-07-08T00:00:00.000Z" },
        now
      )
    ).toBe(false);
  });

  it("does not expire a demand that already left OPEN (MATCHED/terminal)", () => {
    const now = new Date("2026-07-07T12:00:00.000Z");
    const pastDeadline = "2026-07-07T11:00:00.000Z";
    expect(
      shouldExpireDemand(
        { status: DemandStatus.Matched, deadline: pastDeadline },
        now
      )
    ).toBe(false);
    expect(
      shouldExpireDemand(
        { status: DemandStatus.Expired, deadline: pastDeadline },
        now
      )
    ).toBe(false);
    expect(
      shouldExpireDemand(
        { status: DemandStatus.Cancelled, deadline: pastDeadline },
        now
      )
    ).toBe(false);
  });

  it("skips a row with an unparseable deadline (parses to NaN)", () => {
    const now = new Date("2026-07-07T12:00:00.000Z");
    expect(
      shouldExpireDemand(
        { status: DemandStatus.Open, deadline: "not-a-date" },
        now
      )
    ).toBe(false);
  });
});

// shouldCompleteDemand (Issue 09): the hourly complete job finds MATCHED
// demands that have been MATCHED for at least 7 days and flips them to
// COMPLETED. Same idempotency shape as expire: SQL pre-filter + pure re-check,
// so a row that already left MATCHED (or isn't old enough) is skipped.
describe("shouldCompleteDemand", () => {
  it("completes a MATCHED demand older than 7 days", () => {
    // now is 8 days after updatedAt → well past the 7-day threshold.
    const now = new Date("2026-07-15T12:00:00.000Z");
    expect(
      shouldCompleteDemand(
        { status: DemandStatus.Matched, updatedAt: "2026-07-07T12:00:00.000Z" },
        now
      )
    ).toBe(true);
  });

  it("does not complete a MATCHED demand younger than 7 days", () => {
    // 6 days after updatedAt — still inside the 7-day window.
    const now = new Date("2026-07-13T12:00:00.000Z");
    expect(
      shouldCompleteDemand(
        { status: DemandStatus.Matched, updatedAt: "2026-07-07T12:00:00.000Z" },
        now
      )
    ).toBe(false);
  });

  it("completes a MATCHED demand exactly 7 days old (>= boundary)", () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    expect(
      shouldCompleteDemand(
        { status: DemandStatus.Matched, updatedAt: "2026-07-07T12:00:00.000Z" },
        now
      )
    ).toBe(true);
  });

  it("does not complete a demand that already left MATCHED", () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    const oldUpdatedAt = "2026-07-01T12:00:00.000Z";
    expect(
      shouldCompleteDemand(
        { status: DemandStatus.Completed, updatedAt: oldUpdatedAt },
        now
      )
    ).toBe(false);
    expect(
      shouldCompleteDemand(
        { status: DemandStatus.Open, updatedAt: oldUpdatedAt },
        now
      )
    ).toBe(false);
  });

  it("skips a row with an unparseable updatedAt", () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    expect(
      shouldCompleteDemand(
        { status: DemandStatus.Matched, updatedAt: "not-a-date" },
        now
      )
    ).toBe(false);
  });
});

describe("COMPLETE_AFTER_MS", () => {
  it("is exactly 7 days in milliseconds", () => {
    expect(COMPLETE_AFTER_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
