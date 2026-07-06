// User-related enums shared across web + edge functions.
// Values are stored as text in `public.profiles` (tier, kyc_status).

/** Credit tier — placeholder for Phase 2 credit engine. */
export const CreditTier = {
  None: "None",
  Bronze: "Bronze",
  Silver: "Silver",
  Gold: "Gold",
} as const;
export type CreditTier = (typeof CreditTier)[keyof typeof CreditTier];

/** KYC lifecycle. Sellers must be APPROVED before submitting offers. */
export const KycStatus = {
  None: "None",
  Pending: "Pending",
  Approved: "Approved",
  Rejected: "Rejected",
} as const;
export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];

export const CREDIT_TIERS = Object.values(CreditTier);
export const KYC_STATUSES = Object.values(KycStatus);
