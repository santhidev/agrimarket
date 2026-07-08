import { z } from "zod";
import { CreditTier, KycStatus } from "../users/enums";

// Admin dashboard validation schemas (Issue 18).
//
// userFilterSchema validates the query string of GET /api/admin/users
// (search + kycStatus + tier + page + pageSize). setCreditTierSchema validates
// the body of PATCH /api/admin/users/:id/credit-tier. Both are strict so a typo
// in a param name fails loudly instead of being silently ignored.

/// Query params for GET /api/admin/users. `page` / `pageSize` coerce from the
/// string a URL gives us; the rest are enum-typed. `.strict()` rejects unknown
/// keys so a misspelled filter is a 400, not a silent no-op.
export const userFilterSchema = z
  .object({
    search: z.string().trim().optional(),
    kycStatus: z
      .enum([KycStatus.None, KycStatus.Pending, KycStatus.Approved, KycStatus.Rejected])
      .optional(),
    tier: z
      .enum([CreditTier.None, CreditTier.Bronze, CreditTier.Silver, CreditTier.Gold])
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(50),
  })
  .strict();

/// Body for PATCH /api/admin/users/:id/credit-tier. The single field is the new
/// credit tier; the route applies it via the service-role admin client (RLS
/// blocks admin UPDATEs on other users' profiles).
export const setCreditTierSchema = z
  .object({
    tier: z.enum([CreditTier.None, CreditTier.Bronze, CreditTier.Silver, CreditTier.Gold]),
  })
  .strict();

export type UserFilter = z.infer<typeof userFilterSchema>;
export type SetCreditTierInput = z.infer<typeof setCreditTierSchema>;
