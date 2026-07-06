import { describe, it, expect } from "vitest";
import { withDefaultGrade, DEFAULT_GRADE_NAME } from "./default-grade";

describe("DEFAULT_GRADE_NAME", () => {
  it("is the Thai 'มาตรฐาน' label", () => {
    expect(DEFAULT_GRADE_NAME).toBe("มาตรฐาน");
  });
});

describe("withDefaultGrade", () => {
  it("returns the synthetic default when the list is empty", () => {
    expect(withDefaultGrade([])).toEqual([{ name: DEFAULT_GRADE_NAME }]);
  });

  it("returns the synthetic default when the list is null/undefined", () => {
    expect(withDefaultGrade(null as unknown as never[])).toEqual([
      { name: DEFAULT_GRADE_NAME },
    ]);
    expect(withDefaultGrade(undefined as unknown as never[])).toEqual([
      { name: DEFAULT_GRADE_NAME },
    ]);
  });

  it("returns the original list untouched when it already has grades", () => {
    const grades = [{ name: "A" }, { name: "B" }, { name: "C" }];
    expect(withDefaultGrade(grades)).toBe(grades);
  });

  it("preserves extra fields (description, sortOrder, id) on real grades", () => {
    const grades = [
      { id: "g1", name: "A", description: "พิเศษ", sortOrder: 0 },
    ];
    expect(withDefaultGrade(grades)).toEqual(grades);
  });
});
