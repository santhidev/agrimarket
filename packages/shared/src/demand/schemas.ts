import { z } from "zod";
import { DemandStatus } from "./enums";

// Demand request/response schemas (Issue 07).
//
// A Demand is a buyer's "wanted" post for one Product: how much, by when, and
// where (lat/lng for the Haversine distance calc). It tracks pending_quantity
// (the uncommitted portion) which starts equal to quantity and drops as offers
// are accepted (#10). MVP lifecycle: OPEN → MATCHED → COMPLETED (self-pickup,
// no payment in-system). Buyer-only writes; public browse reads.
//
// Shared between API request validation and client form validation — camelCase
// API contract (DB stores snake_case; route handlers map — see
// apps/web/app/api/demands/mapping.ts).

const uuid = z.string().uuid();

// --- Create -----------------------------------------------------------------

/// Request body for POST /api/demands. buyerId is pinned to the session user
/// by the API (never trusted from the body), and pending_quantity is set to
/// `quantity` server-side via initialPendingQuantity — so neither appears here.
///
/// The deadline must be in the future (the buyer is asking for something they
/// still need). Lat/lng ranges match the DB CHECK constraints.
export const createDemandSchema = z
  .object({
    productId: uuid,
    quantity: z.number().int().positive("ต้องมากกว่า 0"),
    deadline: z
      .string()
      .min(1)
      .refine((v) => !Number.isNaN(Date.parse(v)), "รูปแบบวันที่ไม่ถูกต้อง")
      .refine((v) => Date.parse(v) > Date.now(), "กำหนดปิดรับต้องเป็นวันในอนาคต"),
    buyerLat: z.number().min(-90).max(90),
    buyerLng: z.number().min(-180).max(180),
  })
  .strict();

// --- Extend (Issue 08) ------------------------------------------------------

/// Request body for PATCH /api/demands/:id. Issue 08 scope is deadline only —
/// quantity/product/lat-lng are immutable after create, and status flips via
/// DELETE (cancel). The new deadline must be in the future; the route adds the
/// "strictly later than the current deadline" check via isDeadlineExtension so
/// the helper owns the ordering rule (not the schema, which has no cross-field
/// context).
export const extendDemandSchema = z
  .object({
    deadline: z
      .string()
      .min(1)
      .refine((v) => !Number.isNaN(Date.parse(v)), "รูปแบบวันที่ไม่ถูกต้อง")
      .refine((v) => Date.parse(v) > Date.now(), "กำหนดปิดรับต้องเป็นวันในอนาคต"),
  })
  .strict();

// --- Browse query -----------------------------------------------------------

// z.enum needs a literal tuple; derive it once from the canonical enum.
const STATUS_TUPLE = [
  DemandStatus.Open,
  DemandStatus.Matched,
  DemandStatus.Completed,
  DemandStatus.Expired,
  DemandStatus.Cancelled,
] as const;

/// Query params for GET /api/demands. Both filters optional — an empty query
/// returns all OPEN demands newest first. Not strict: Next.js may pass extras
/// (e.g. cache busters) that should be ignored, not 400.
export const demandQuerySchema = z.object({
  productId: uuid.optional(),
  status: z.enum(STATUS_TUPLE).optional(),
});

// --- Counter-offer (Issues 11 + 12) -----------------------------------------

/// Request body for POST /api/demands/:id/counter-offer. The buyer sends a
/// desired price; sellers respond by editing their own offer price down (reuses
/// PATCH from #10). The counter-offer does NOT change any offer's status — it
/// only feeds the competitive bidding visibility rule (#11): a seller whose
/// offer price ≤ the counter-offer price is "accepted" (price visible to
/// competitors). Unlimited rounds; the latest write wins. The route applies
/// canEditDemand (OPEN-only) separately — a closed demand stops negotiating.
export const counterOfferSchema = z
  .object({
    pricePerUnit: z.number().positive("ราคาต้องมากกว่า 0"),
  })
  .strict();

// --- Read shape (camelCase API contract) ------------------------------------

/// Demand row as returned by the API. Mirrors public.demands + the joined
/// product name/unit. `offers` is an empty array placeholder for Issue #10
/// (GET /api/demands/:id returns the demand with its offers inlined).
/// counterOfferPrice/counterOfferAt are null until the buyer sends a
/// counter-offer (Issues 11 + 12); once set, the latest values stay until the
/// buyer sends another round.
export const demandSchema = z.object({
  id: uuid,
  productId: uuid,
  productName: z.string(),
  unit: z.string(),
  buyerId: uuid,
  quantity: z.number().int().positive(),
  pendingQuantity: z.number().int().min(0),
  status: z.enum([
    DemandStatus.Open,
    DemandStatus.Matched,
    DemandStatus.Completed,
    DemandStatus.Expired,
    DemandStatus.Cancelled,
  ]),
  buyerLat: z.number(),
  buyerLng: z.number(),
  deadline: z.string(),
  counterOfferPrice: z.number().nullable(),
  counterOfferAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  offers: z.array(z.unknown()).default([]),
});

export type CreateDemandInput = z.infer<typeof createDemandSchema>;
export type ExtendDemandInput = z.infer<typeof extendDemandSchema>;
export type CounterOfferInput = z.infer<typeof counterOfferSchema>;
export type DemandQuery = z.infer<typeof demandQuerySchema>;
export type Demand = z.infer<typeof demandSchema>;

// Re-export the status enum so callers have one import surface.
export { DemandStatus };
