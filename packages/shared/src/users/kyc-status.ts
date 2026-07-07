// Per-submission lifecycle statuses (Issue 06).
//
// These mirror public.kyc_submissions.status (CHECK list) — uppercase DB
// values, matching the product-suggestion convention from Issue 05. They are
// distinct from `KycStatus` in enums.ts, which is the headline value stored on
// public.profiles.kyc_status (None / Pending / Approved / Rejected). A
// submission row is never "None" — it is created PENDING and resolves to
// APPROVED or REJECTED; the profile flips accordingly.
export const KycSubmissionStatus = {
  Pending: "PENDING",
  Approved: "APPROVED",
  Rejected: "REJECTED",
} as const;

export type KycSubmissionStatus =
  (typeof KycSubmissionStatus)[keyof typeof KycSubmissionStatus];

export const KYC_SUBMISSION_STATUSES = Object.values(KycSubmissionStatus);
