// Catalog helpers shared across web + edge functions.

/** Default grade name shown when a product has no defined grades. */
export const DEFAULT_GRADE_NAME = "มาตรฐาน";

/** Minimal shape of a grade row as consumed by the UI/API. */
export type GradeLike = { name: string };

/**
 * Products without explicit grades still expose a single "มาตรฐาน" grade on
 * read (per CONTEXT.md: "บางสินค้าไม่มีเกรด = ใช้ 'มาตรฐาน'"). Returns the
 * original list untouched when it already has grades, otherwise a synthetic
 * one-element default list.
 */
export function withDefaultGrade<T extends GradeLike>(grades: T[] | null | undefined): T[] {
  if (!grades || grades.length === 0) {
    return [{ name: DEFAULT_GRADE_NAME } as T];
  }
  return grades;
}
