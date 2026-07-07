// Demand lifecycle statuses shared across web + edge functions (Issue 07).
//
// Values are stored as text in public.demands.status (CHECK list) — uppercase,
// matching the kyc/product-suggestion convention. The MVP Demand state machine
// is OPEN → MATCHED → COMPLETED, with EXPIRED (deadline passed) and CANCELLED
// (buyer withdraws) as terminal exits (see CONTEXT.md "State Machines").

/** Demand lifecycle. OPEN on create; MATCHED when fully covered by offers. */
export const DemandStatus = {
  Open: "OPEN",
  Matched: "MATCHED",
  Completed: "COMPLETED",
  Expired: "EXPIRED",
  Cancelled: "CANCELLED",
} as const;
export type DemandStatus = (typeof DemandStatus)[keyof typeof DemandStatus];

export const DEMAND_STATUSES = Object.values(DemandStatus);
