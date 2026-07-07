import { KycStatus } from "./enums";

// Pure state-machine logic for KYC submissions (Issue 06).
//
// A user's `profiles.kyc_status` is the headline state; each KYC submission in
// `kyc_submissions` has its own lifecycle (PENDING → APPROVED / REJECTED). The
// acceptance criteria call out two paths:
//
//   None → Pending → Approved
//   None → Pending → Rejected → Pending → Approved   (resubmit after rejection)
//
// `Approved` is terminal for the user: once approved they cannot resubmit
// (they already are). `None`/`Rejected` may submit; `Pending` may not (one
// in-flight submission at a time — admin must resolve the current one first).

// --- Can the user submit a new KYC submission right now? --------------------

/// A user may submit when they are unverified (None) or were last rejected.
/// They cannot submit while a submission is Pending, nor after approval.
export function canSubmitKyc(status: KycStatus): boolean {
  return status === KycStatus.None || status === KycStatus.Rejected;
}

// --- Headline profile state after a submission event ------------------------

export type KycEvent = "submit" | "approve" | "reject";

/// The next `profiles.kyc_status` after a submission event. Returns null when
/// the event is illegal for the current state (caller decides → 409 or ignore).
///
///   submit:  None|Rejected → Pending
///   approve: Pending       → Approved
///   reject:  Pending       → Rejected
export function nextKycStatus(
  current: KycStatus,
  event: KycEvent
): KycStatus | null {
  switch (event) {
    case "submit":
      return canSubmitKyc(current) ? KycStatus.Pending : null;
    case "approve":
      return current === KycStatus.Pending ? KycStatus.Approved : null;
    case "reject":
      return current === KycStatus.Pending ? KycStatus.Rejected : null;
  }
}
