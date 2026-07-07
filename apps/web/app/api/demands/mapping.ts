// DB row ↔ API shape mappers for the demand routes (Issue 07, extended 10).
//
// DB columns are snake_case; the API contract (see @agrimarket/shared
// demandSchema) is camelCase. The browse/detail pages also need the joined
// product name + unit (so a demand card can render "มะม่วงน้ำดอกไม้ · 100 กก."
// without a second round-trip). Mirrors the catalog/kyc mapping pattern.

// Nested offer row from public.offers + public.offer_photos. The offers array
// is joined via PostgREST's nested select on the demand detail page (Issue 10).
// The buyer sees all offers on their demand (RLS); a non-buyer sees an empty
// list because the offers SELECT policy hides other sellers' offers.
export type DemandOfferRow = {
  id: string;
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
  offer_photos: { url: string; key: string; sort_order: number }[];
};

// Joined demand row from public.demands + public.products + public.offers. The
// product join is inner because every demand references a real product (FK on
// delete restrict). The offers join is outer-equivalent (an empty array, not
// null, when the demand has no offers).
export type DemandRow = {
  id: string;
  product_id: string;
  buyer_id: string;
  quantity: number;
  pending_quantity: number;
  status: string;
  buyer_lat: number;
  buyer_lng: number;
  deadline: string;
  created_at: string;
  updated_at: string;
  product: { name: string; unit: string };
  offers: DemandOfferRow[];
};

// Select string passed to PostgREST — keeps the column list in sync with
// DemandRow in one place. The nested `product` object is the joined row; the
// nested `offers` array is the demand's offers (Issue 10). The offers join
// runs under the caller's RLS, so a buyer sees all their demand's offers and a
// non-buyer sees an empty array.
export const DEMAND_SELECT =
  "id, product_id, buyer_id, quantity, pending_quantity, status, buyer_lat, buyer_lng, deadline, created_at, updated_at, product:products(name, unit), offers:offers(id, seller_id, product_grade_id, price_per_unit, quantity, accepted_quantity, status, pickup_lat, pickup_lng, ready_date, created_at, updated_at, offer_photos(url, key, sort_order))";

export function mapDemand(row: DemandRow) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product.name,
    unit: row.product.unit,
    buyerId: row.buyer_id,
    quantity: row.quantity,
    pendingQuantity: row.pending_quantity,
    status: row.status,
    buyerLat: row.buyer_lat,
    buyerLng: row.buyer_lng,
    deadline: row.deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Issue 10: offers are now embedded. A buyer sees all offers on their
    // demand; a non-buyer (or anon) sees an empty array (RLS hides them).
    offers: (row.offers ?? []).map((o) => ({
      id: o.id,
      sellerId: o.seller_id,
      productGradeId: o.product_grade_id,
      pricePerUnit:
        typeof o.price_per_unit === "string"
          ? Number(o.price_per_unit)
          : o.price_per_unit,
      quantity: o.quantity,
      acceptedQuantity: o.accepted_quantity,
      status: o.status,
      pickupLat: o.pickup_lat,
      pickupLng: o.pickup_lng,
      readyDate: o.ready_date,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      photos: (o.offer_photos ?? []).map((p) => ({
        url: p.url,
        key: p.key,
        sortOrder: p.sort_order,
      })),
    })),
  };
}
