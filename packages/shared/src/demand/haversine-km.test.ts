import { describe, it, expect } from "vitest";
import { haversineKm } from "./haversine-km";

// Great-circle distance between two lat/lng points (Issue 13 tiebreaker).
//
// Used as the distance tiebreaker in the best-offer solver: when two offer
// combinations have the same total cost, the one with the smaller total
// distance (buyer → each pickup, weighted by quantity) wins. Pure — a test
// with known coordinates is a faithful check. R = 6371 km (Earth mean radius).

describe("haversineKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineKm(13.7563, 100.5018, 13.7563, 100.5018)).toBe(0);
  });

  it("returns ~111 km per 1° of latitude (known formula sanity)", () => {
    // 1° latitude ≈ 111.19 km at Bangkok's latitude using the mean Earth
    // radius. Allow a small tolerance — the exact value depends on R.
    const d = haversineKm(13, 100, 14, 100);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it("is symmetric (a→b equals b→a)", () => {
    const a = haversineKm(13.7563, 100.5018, 18.7883, 98.9853);
    const b = haversineKm(18.7883, 98.9853, 13.7563, 100.5018);
    expect(Math.abs(a - b)).toBeLessThan(1e-9);
  });

  it("returns a positive distance for distinct points", () => {
    const d = haversineKm(13.7563, 100.5018, 18.7883, 98.9853);
    expect(d).toBeGreaterThan(500);
    expect(d).toBeLessThan(600);
  });
});
