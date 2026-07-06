// DB row ↔ API shape mappers for the catalog routes.
// DB columns are snake_case; the API contract (see @agrimarket/shared
// productSchema / productGradeSchema) is camelCase. Keeping the mapping in one
// place mirrors the profile-route pattern from Issue 03.

export type ProductRow = {
  id: string;
  name: string;
  category: string;
  unit: string;
  requires_cold_chain: boolean;
  is_fragile: boolean;
  shelf_life_hours: number | null;
  is_stackable: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductGradeRow = {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export const PRODUCT_SELECT =
  "id, name, category, unit, requires_cold_chain, is_fragile, shelf_life_hours, is_stackable, created_at, updated_at";

export const GRADE_SELECT =
  "id, product_id, name, description, sort_order, created_at";

export function mapProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    requiresColdChain: row.requires_cold_chain,
    isFragile: row.is_fragile,
    shelfLifeHours: row.shelf_life_hours,
    isStackable: row.is_stackable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGrade(row: ProductGradeRow) {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
  };
}
