import { z } from "zod";
import { OfferStatus } from "./enums";

// Offer request/response schemas (Issue 10).
//
// An Offer is a seller's response to a Demand: their price, quantity, grade,
// pickup location, when they can deliver, and optional product photos. The
// seller pins themselves (seller_id) and the demand (demand_id); the rest is
// the seller's proposed terms. Shared between API request validation and
// client form validation — camelCase API contract (DB stores snake_case; the
// route handler maps — see apps/web/app/api/offers/mapping.ts).
//
// Photos follow the KYC #06 pattern: the client uploads to Storage first and
// posts the resulting url+key pairs. On PATCH, photos are replaced wholesale
// (delete old + insert new) so the route doesn't diff partial arrays.

const uuid = z.string().uuid();

// A Storage-backed photo: the client uploads, then posts both the public url
// and the object key. Both are persisted so a future delete can remove the
// object by key (AGENTS.md InsForge pattern).
const photoSchema = z.object({
  url: z.string().min(1),
  key: z.string().min(1),
});

// readyDate is a calendar day (date, not timestamptz) — the seller says "พร้อม
// ส่งวันที่ X", not a specific minute. The future-check compares the parsed
// date at UTC midnight against today at UTC midnight so a same-day ready_date
// is allowed (the seller can deliver today).
const todayUtc = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const readyDateSchema = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), "รูปแบบวันที่ไม่ถูกต้อง")
  .refine((v) => Date.parse(v) >= todayUtc().getTime(), "วันพร้อมส่งต้องเป็นวันนี้หรือหลังจากนี้");

// --- Create -----------------------------------------------------------------

/// Request body for POST /api/offers. sellerId is pinned to the session user
/// by the API (never trusted from the body), and status defaults to ACTIVE
/// server-side — so neither appears here. productGradeId is optional because
/// some products have no grades ("มาตรฐาน", per CONTEXT.md).
export const createOfferSchema = z
  .object({
    demandId: uuid,
    productGradeId: uuid.optional(),
    pricePerUnit: z.number().positive("ราคาต้องมากกว่า 0"),
    quantity: z.number().int().positive("ต้องมากกว่า 0"),
    photos: z.array(photoSchema).default([]),
    pickupLat: z.number().min(-90).max(90),
    pickupLng: z.number().min(-180).max(180),
    readyDate: readyDateSchema,
  })
  .strict();

// --- Update (Issue 10) ------------------------------------------------------

/// Request body for PATCH /api/offers/:id. Every editable field is optional,
/// but at least one must be present (a no-op PATCH is a client bug). demandId
/// and sellerId are immutable after create; status flips via DELETE (withdraw)
/// or the buyer-select flow (#11), never via this route. Photos, if present,
/// replace the existing set wholesale.
export const updateOfferSchema = z
  .object({
    productGradeId: uuid.optional(),
    pricePerUnit: z.number().positive("ราคาต้องมากกว่า 0").optional(),
    quantity: z.number().int().positive("ต้องมากกว่า 0").optional(),
    photos: z.array(photoSchema).optional(),
    pickupLat: z.number().min(-90).max(90).optional(),
    pickupLng: z.number().min(-180).max(180).optional(),
    readyDate: readyDateSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "ต้องระบุอย่างน้อยหนึ่งฟิลด์");

// --- Read shape (camelCase API contract) ------------------------------------

/// Offer row as returned by the API. Mirrors public.offers + the inlined
/// offer_photos. `acceptedQuantity` is null until the buyer selects (#11).
export const offerSchema = z.object({
  id: uuid,
  demandId: uuid,
  sellerId: uuid,
  productGradeId: uuid.nullable(),
  pricePerUnit: z.number(),
  quantity: z.number().int().positive(),
  acceptedQuantity: z.number().int().nullable(),
  status: z.enum([
    OfferStatus.Active,
    OfferStatus.PendingSellerConfirmation,
    OfferStatus.Confirmed,
    OfferStatus.Matched,
    OfferStatus.Withdrawn,
    OfferStatus.Rejected,
    OfferStatus.Expired,
    OfferStatus.Cancelled,
    OfferStatus.Declined,
  ]),
  pickupLat: z.number(),
  pickupLng: z.number(),
  readyDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  photos: z
    .array(
      z.object({ url: z.string(), key: z.string(), sortOrder: z.number().int() })
    )
    .default([]),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;
export type Offer = z.infer<typeof offerSchema>;

// --- Buyer select (Issue 14) ------------------------------------------------

/// Request body for POST /api/demands/:id/select. The buyer picks a set of
/// offers + the accepted_quantity for each (≤ the offer's offered quantity).
/// The array must be non-empty (at least one offer selected); the route
/// validates the sum + per-offer caps via isValidSelectionQuantities after
/// loading the offer rows (the schema can't cross-check against offer rows).
export const selectOffersSchema = z
  .object({
    offers: z
      .array(
        z.object({
          offerId: uuid,
          acceptedQuantity: z.number().int().positive("ต้องมากกว่า 0"),
        })
      )
      .min(1, "ต้องเลือกอย่างน้อยหนึ่งข้อเสนอ"),
  })
  .strict();

export type SelectOffersInput = z.infer<typeof selectOffersSchema>;

// Re-export the status enum so callers have one import surface.
export { OfferStatus };
