import { z } from "zod";

// Catalog request/response schemas shared between API request validation and
// client form validation. API shapes are camelCase (the DB stores snake_case;
// route handlers map between the two — see apps/web/app/api/products/*).

const uuid = z.string().uuid();
const nonEmpty = z.string().trim().min(1);
const nullableInt = z.number().int().nullish();

// --- Product write ----------------------------------------------------------

const productCore = {
  name: nonEmpty.min(1, "กรุณาระบุชื่อสินค้า"),
  category: nonEmpty.min(1, "กรุณาระบุหมวดสินค้า"),
  unit: z.string().trim().min(1).default("กก."),
  requiresColdChain: z.boolean().default(false),
  isFragile: z.boolean().default(false),
  shelfLifeHours: nullableInt
    .refine((v) => v === null || v === undefined || v > 0, "ต้องเป็นจำนวนชั่วโมงที่มากกว่า 0")
    .transform((v) => (v === undefined ? null : v)),
  isStackable: z.boolean().default(true),
};

/// Request body for POST /api/products.
export const createProductSchema = z.object(productCore).strict();

/// Request body for PATCH /api/products/:id. All fields optional; validates
/// any provided field with the same rules as createProductSchema.
export const updateProductSchema = z
  .object({
    name: productCore.name.optional(),
    category: productCore.category.optional(),
    unit: productCore.unit.optional(),
    requiresColdChain: z.boolean().optional(),
    isFragile: z.boolean().optional(),
    shelfLifeHours: nullableInt
      .refine((v) => v === null || v === undefined || v > 0, "ต้องเป็นจำนวนชั่วโมงที่มากกว่า 0")
      .optional(),
    isStackable: z.boolean().optional(),
  })
  .strict();

// --- Grade write ------------------------------------------------------------

/// Request body for POST /api/products/:id/grades.
export const createGradeSchema = z
  .object({
    name: nonEmpty.min(1, "กรุณาระบุชื่อเกรด"),
    description: z.string().nullable().optional(),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();

/// Request body for PATCH /api/product-grades/:id.
export const updateGradeSchema = z
  .object({
    name: nonEmpty.min(1).optional(),
    description: z.string().nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict();

// --- Read shapes (camelCase API contract) -----------------------------------

/// Product row as returned by the catalog API. Mirrors `public.products`.
export const productSchema = z.object({
  id: uuid,
  name: z.string(),
  category: z.string(),
  unit: z.string(),
  requiresColdChain: z.boolean(),
  isFragile: z.boolean(),
  shelfLifeHours: z.number().int().nullable(),
  isStackable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/// Grade row as returned by the catalog API. Mirrors `public.product_grades`.
export const productGradeSchema = z.object({
  id: uuid,
  productId: uuid,
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateGradeInput = z.infer<typeof createGradeSchema>;
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;
export type Product = z.infer<typeof productSchema>;
export type ProductGrade = z.infer<typeof productGradeSchema>;
