// Notification type vocabulary (Issue 17).
//
// type is plain text in the DB (no CHECK list — see the comment on
// migrations/20260707144511_create-notifications.sql); this enum is the
// single source of truth for the string values, shared between the routes
// (inserts) and the client (render).

export const NotificationType = {
  OfferCreated: "offer.created",
  OfferSellerConfirmed: "offer.seller_confirmed",
  OfferSellerDeclined: "offer.seller_declined",
  OfferAutoDeclined: "offer.auto_declined",
  DemandCreated: "demand.created",
  DemandExpired: "demand.expired",
  DemandCompleted: "demand.completed",
  CounterOfferReceived: "counter_offer.received",
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];
