// DB row ↔ API shape mappers for the KYC routes.
// DB columns are snake_case; the API contract (see @agrimarket/shared
// kycSubmissionSchema) is camelCase. Mirrors the catalog/mapping pattern.

export type KycSubmissionRow = {
  id: string;
  user_id: string;
  id_card_photo_url: string;
  id_card_photo_key: string;
  selfie_url: string;
  selfie_key: string;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

export const KYC_SUBMISSION_SELECT =
  "id, user_id, id_card_photo_url, id_card_photo_key, selfie_url, selfie_key, status, rejection_reason, reviewed_by, submitted_at, reviewed_at";

export function mapKycSubmission(row: KycSubmissionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    idCardPhotoUrl: row.id_card_photo_url,
    idCardPhotoKey: row.id_card_photo_key,
    selfieUrl: row.selfie_url,
    selfieKey: row.selfie_key,
    status: row.status,
    rejectionReason: row.rejection_reason,
    reviewedBy: row.reviewed_by,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  };
}
