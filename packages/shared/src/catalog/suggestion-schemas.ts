import { z } from "zod";

// Product suggestion request/response schemas + helpers (Issue 05).
//
// A suggestion is a user-proposed catalog product that admins approve or reject.
// On approve, a `products` row is created from the suggestion (see
// buildProductFromSuggestion). Shared with API request validation and client
// form validation — camelCase API contract, snake_case DB (route handlers map
// between the two — see apps/web/app/api/product-suggestions/*).

// Lifecycle statuses mirror public.product_suggestions.status (CHECK list).
export const SuggestionStatus = {
  Pending: "PENDING",
  Approved: "APPROVED",
  Rejected: "REJECTED",
} as const;

export type SuggestionStatus = (typeof SuggestionStatus)[keyof typeof SuggestionStatus];

const uuid = z.string().uuid();
const nonEmpty = z.string().trim().min(1);

// --- Suggestion write -------------------------------------------------------

/// Request body for POST /api/product-suggestions. Only catalog-display fields
/// are user-supplied; status/reviewer/timestamps are set by the API.
export const createProductSuggestionSchema = z
  .object({
    name: nonEmpty.min(1, "กรุณาระบุชื่อสินค้า"),
    category: nonEmpty.min(1, "กรุณาระบุหมวดสินค้า"),
    unit: z.string().trim().min(1).default("กก."),
  })
  .strict();

/// Request body for POST /api/admin/product-suggestions/:id/reject. A reason
/// is mandatory so the requester is told why their suggestion was declined.
export const rejectProductSuggestionSchema = z
  .object({
    rejectionReason: nonEmpty.min(1, "กรุณาระบุเหตุผลที่ปฏิเสธ"),
  })
  .strict();

// --- Approve → product payload ---------------------------------------------

// Suggestion-like input (zod-parsed body or DB camelCase row). Only the
// catalog-display fields matter when materializing a product. `unit` is
// optional so callers can pass a raw body before zod applies its default.
type SuggestionLike = {
  name: string;
  category: string;
  unit?: string;
};

/// Build a snake_case `products` insert payload from a suggestion, applying the
/// catalog defaults documented in Issue 04 (non-suggested fields). Returns the
/// minimal set of columns needed to create a product; the DB fills id/timestamps.
export function buildProductFromSuggestion(suggestion: SuggestionLike) {
  return {
    name: suggestion.name,
    category: suggestion.category,
    unit: suggestion.unit ?? "กก.",
    requires_cold_chain: false,
    is_fragile: false,
    shelf_life_hours: null,
    is_stackable: true,
  };
}

// --- Read shape (camelCase API contract) ------------------------------------

/// Suggestion row as returned by the API. Mirrors public.product_suggestions.
export const productSuggestionSchema = z.object({
  id: uuid,
  requesterId: uuid,
  name: z.string(),
  category: z.string(),
  unit: z.string(),
  status: z.enum([
    SuggestionStatus.Pending,
    SuggestionStatus.Approved,
    SuggestionStatus.Rejected,
  ]),
  rejectionReason: z.string().nullable(),
  reviewedBy: uuid.nullable(),
  submittedAt: z.string(),
  reviewedAt: z.string().nullable(),
});

export type CreateProductSuggestionInput = z.infer<typeof createProductSuggestionSchema>;
export type RejectProductSuggestionInput = z.infer<typeof rejectProductSuggestionSchema>;
export type ProductSuggestion = z.infer<typeof productSuggestionSchema>;
