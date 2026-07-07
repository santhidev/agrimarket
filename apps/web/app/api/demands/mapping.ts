// DB row ↔ API shape mappers for the demand routes (Issue 07).
//
// DB columns are snake_case; the API contract (see @agrimarket/shared
// demandSchema) is camelCase. The browse/detail pages also need the joined
// product name + unit (so a demand card can render "มะม่วงน้ำดอกไม้ · 100 กก."
// without a second round-trip). Mirrors the catalog/kyc mapping pattern.

// Joined demand row from public.demands + public.products. The product join is
// inner because every demand references a real product (FK on delete restrict).
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
};

// Select string passed to PostgREST — keeps the column list in sync with
// DemandRow in one place. The nested `product` object is the joined row.
export const DEMAND_SELECT =
  "id, product_id, buyer_id, quantity, pending_quantity, status, buyer_lat, buyer_lng, deadline, created_at, updated_at, product:products(name, unit)";

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
    // Offers are loaded by GET /api/demands/:id once the offers table exists
    // (#10). The list endpoint never embeds them, so default to empty.
    offers: [] as unknown[],
  };
}
