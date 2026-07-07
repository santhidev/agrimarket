import { z } from "zod";
import { KycStatus } from "./enums";
import { KycSubmissionStatus } from "./kyc-status";

// KYC submission request/response schemas (Issue 06).
//
// A KYC submission is a seller's identity verification: an ID-card photo and a
// selfie (uploaded to InsForge Storage by the client, which returns a url+key
// pair per file). The API stores both url and key so files can be displayed
// (url) and later deleted (key) — see the InsForge storage idiom. Admins review
// pending submissions and approve/reject; approve flips the user's
// `profiles.kyc_status` to APPROVED so they may submit offers (#10).

const uuid = z.string().uuid();
const nonEmpty = z.string().trim().min(1);

// A url+key pair returned by InsForge Storage after a client upload. Both are
// mandatory and persisted: the url for display, the key for download/delete.
const photo = z.object({
  url: z.string().trim().min(1).url(),
  key: z.string().trim().min(1),
});

// --- Submission write ------------------------------------------------------

/// Request body for POST /api/kyc. The client uploads both photos to Storage
/// first, then posts the resulting url+key pairs. status/reviewer/timestamps
/// are set by the API.
export const createKycSubmissionSchema = z
  .object({
    idCardPhoto: photo,
    selfie: photo,
  })
  .strict();

/// Request body for POST /api/admin/kyc/:id/reject. A reason is mandatory so
/// the seller is told why their KYC was declined (and what to fix before
/// resubmitting).
export const rejectKycSubmissionSchema = z
  .object({
    rejectionReason: nonEmpty.min(1, "กรุณาระบุเหตุผลที่ปฏิเสธ"),
  })
  .strict();

// --- Read shape (camelCase API contract) -----------------------------------

/// KYC submission row as returned by the API. Mirrors public.kyc_submissions.
export const kycSubmissionSchema = z.object({
  id: uuid,
  userId: uuid,
  idCardPhotoUrl: z.string(),
  idCardPhotoKey: z.string(),
  selfieUrl: z.string(),
  selfieKey: z.string(),
  status: z.enum([
    KycSubmissionStatus.Pending,
    KycSubmissionStatus.Approved,
    KycSubmissionStatus.Rejected,
  ]),
  rejectionReason: z.string().nullable(),
  reviewedBy: uuid.nullable(),
  submittedAt: z.string(),
  reviewedAt: z.string().nullable(),
});

export type CreateKycSubmissionInput = z.infer<typeof createKycSubmissionSchema>;
export type RejectKycSubmissionInput = z.infer<typeof rejectKycSubmissionSchema>;
export type KycSubmission = z.infer<typeof kycSubmissionSchema>;

// Re-export the status + profile enums so callers have one import surface.
export { KycStatus, KycSubmissionStatus };
