import { z } from "zod";

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
