// DB row ↔ API shape mappers for the offer routes (Issue 10).
//
// DB columns are snake_case; the API contract (see @agrimarket/shared
// offerSchema) is camelCase. The nested `offer_photos` array is joined via
// PostgREST's nested select so a single round-trip returns the offer + its
// photos. Mirrors the demand/kyc mapping pattern.

// Nested photo row from public.offer_photos. sort_order preserves the seller's
// chosen photo order on the demand detail page.
export type OfferPhotoRow = {
  url: string;
  key: string;
  sort_order: number;
};

// Joined offer row from public.offers + public.offer_photos. The photos array
// is the nested select result (empty array if the offer has no photos).
export type OfferRow = {
  id: string;
  demand_id: string;
  seller_id: string;
  product_grade_id: string | null;
  price_per_unit: string | number;
  quantity: number;
  accepted_quantity: number | null;
  status: string;
  pickup_lat: number;
  pickup_lng: number;
  ready_date: string;
  created_at: string;
  updated_at: string;
  offer_photos: OfferPhotoRow[];
};

// Select string passed to PostgREST — keeps the column list in sync with
// OfferRow in one place. The nested `offer_photos` object is the joined rows,
// ordered by sort_order.
export const OFFER_SELECT =
  "id, demand_id, seller_id, product_grade_id, price_per_unit, quantity, accepted_quantity, status, pickup_lat, pickup_lng, ready_date, created_at, updated_at, offer_photos(url, key, sort_order)";

export function mapOffer(row: OfferRow) {
  return {
    id: row.id,
    demandId: row.demand_id,
    sellerId: row.seller_id,
    productGradeId: row.product_grade_id,
    pricePerUnit:
      typeof row.price_per_unit === "string"
        ? Number(row.price_per_unit)
        : row.price_per_unit,
    quantity: row.quantity,
    acceptedQuantity: row.accepted_quantity,
    status: row.status,
    pickupLat: row.pickup_lat,
    pickupLng: row.pickup_lng,
    readyDate: row.ready_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photos: (row.offer_photos ?? []).map((p) => ({
      url: p.url,
      key: p.key,
      sortOrder: p.sort_order,
    })),
  };
}
