-- Issues 11 + 12 — Counter-offer + competitive bidding view.
--
-- A counter-offer is the buyer's desired price for a demand (#12). It does NOT
-- change any offer's status — sellers respond by editing their own offer price
-- down (reusing PATCH from #10). When a seller's offer price drops to ≤ the
-- counter-offer price, they are "accepted": their price becomes visible to
-- competing sellers in the competitive bidding view (#11). Unlimited rounds;
-- the latest write wins. Before any counter-offer exists, both columns are
-- NULL and no seller is accepted (competitor prices stay hidden).
--
-- counter_offer_price mirrors offers.price_per_unit's numeric(12,2) scale so
-- the ≤ comparison in isCounterOfferAccepted is exact. counter_offer_at records
-- when the latest round was sent — informational for the seller view + a future
-- "stale counter-offer" UX (#17 notification can read it).
--
-- RLS: no policy change needed. The existing demands_update_owner_or_admin
-- policy already permits the buyer (or admin) to UPDATE the demand row, and the
-- route gates on canEditDemand (OPEN-only) before writing. Sellers cannot write
-- to demands at all (no UPDATE policy for them), which is correct — the
-- counter-offer is buyer-initiated.

alter table public.demands
  add column if not exists counter_offer_price numeric(12,2) null
    check (counter_offer_price > 0),
  add column if not exists counter_offer_at timestamptz null;
