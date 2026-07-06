import { z } from "zod";
import { CREDIT_TIERS, KYC_STATUSES } from "../users/enums";

// Thai mobile number: 0 followed by 8-9 digits (e.g. 0812345678, 021234567).
// Stored and validated as digits-only (no dashes/spaces).
export const phoneSchema = z
  .string()
  .regex(/^0\d{8,9}$/, "เบอร์โทรศัพท์ไม่ถูกต้อง");

/// Request body for POST /api/auth/request-otp.
export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

/// Request body for the Auth.js Credentials authorize callback (phone + code).
export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .regex(/^\d{6}$/, "รหัสยืนยันต้องเป็นตัวเลข 6 หลัก"),
  // Optional FCM push token (Issue 17 notifications).
  fcmToken: z.string().optional(),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/// Shape of a profile row returned by GET /api/users/:id/profile.
/// Mirrors `public.profiles`; used by the web app + edge-function contract.
export const profileSchema = z.object({
  id: z.string().uuid(),
  phone: phoneSchema,
  tier: z.enum(CREDIT_TIERS as [string, ...string[]]),
  kycStatus: z.enum(KYC_STATUSES as [string, ...string[]]),
  buyerScore: z.number().int().min(0),
  sellerScore: z.number().int().min(0),
  isAdmin: z.boolean(),
});

export type Profile = z.infer<typeof profileSchema>;
