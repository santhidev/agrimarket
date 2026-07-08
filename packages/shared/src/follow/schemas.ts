import { z } from "zod";

// Follow schemas shared between the API response shape and client form
// validation (Issue 16).
//
// The follow/unfollow endpoints take the product id from the URL path
// (POST/DELETE /api/products/:id/follow), so there is no request-body schema
// to validate — only the read shapes (a follow row, and the joined
// followed-product for the list endpoint) are shared here. This keeps the API
// contract in one place so the client and the routes stay in sync.

const uuid = z.string().uuid();

/// A follow row as returned by POST /api/products/:id/follow. Mirrors
/// `public.follows` (id, user_id, product_id, created_at). A follow is
/// immutable once created (no fields change), so there is no update shape.
export const followSchema = z
  .object({
    id: uuid,
    userId: uuid,
    productId: uuid,
    createdAt: z.string(),
  })
  .strict();

/// A followed product — the join of follows → products returned by
/// GET /api/follows. The client renders "ทุเรียน · ผลไม้" from name + category
/// without a second round-trip, plus followedAt to sort by recency.
export const followedProductSchema = z
  .object({
    productId: uuid,
    name: z.string(),
    category: z.string(),
    unit: z.string(),
    followedAt: z.string(),
  })
  .strict();

export type Follow = z.infer<typeof followSchema>;
export type FollowedProduct = z.infer<typeof followedProductSchema>;
