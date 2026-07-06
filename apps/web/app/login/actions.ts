"use server";

import { cookies } from "next/headers";
import { createAuthActions, createBrowserClient } from "@insforge/sdk/ssr";
import {
  requestOtpSchema,
  verifyOtpSchema,
  normalizePhone,
} from "@agrimarket/shared";

// Phone OTP auth — server actions.
// Flow: requestOtp → user enters code → verifyOtp (calls edge function) →
// signInWithPassword (establishes InsForge session in cookies).
//
// The login input shows a "+66" prefix, which makes users type the mobile
// without a leading 0 (e.g. "812345678"), paste "+66812345678", or use dashes.
// normalizePhone() canonicalizes all of these to the "0xxxxxxxxx" form that
// the schema and the DB expect — without it, every sign-in attempt is rejected.

export async function requestOtpAction(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return { error: "เบอร์โทรศัพท์ไม่ถูกต้อง" };
  }
  const parsed = requestOtpSchema.safeParse({ phone: normalized });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "เบอร์โทรศัพท์ไม่ถูกต้อง" };
  }

  const client = createBrowserClient();
  const { data, error } = await client.functions.invoke("phone-otp", {
    body: { action: "request", phone: parsed.data.phone },
  });

  if (error) {
    return { error: "ขอรหัสยืนยันไม่สำเร็จ" };
  }

  return { testCode: (data as { testCode?: string }).testCode };
}

export async function verifyOtpAction(phone: string, code: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return { error: "เบอร์โทรศัพท์ไม่ถูกต้อง" };
  }
  const parsed = verifyOtpSchema.safeParse({ phone: normalized, code });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  // 1. Call edge function to verify OTP + find-or-create user.
  const client = createBrowserClient();
  const { data, error } = await client.functions.invoke("phone-otp", {
    body: { action: "verify", phone: parsed.data.phone, code: parsed.data.code },
  });

  if (error || !(data as { user?: unknown }).user) {
    return { error: "รหัสยืนยันไม่ถูกต้องหรือหมดอายุ" };
  }

  // 2. Establish InsForge session via signInWithPassword.
  const userData = data as { user: { email: string; password?: string } };
  const email = userData.user.email;
  const password = userData.user.password ?? `otp-${phone}-agrimarket`;

  const auth = createAuthActions({ cookies: await cookies() });
  const { error: signInError } = await auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }

  return { success: true };
}

export async function signOutAction() {
  const auth = createAuthActions({ cookies: await cookies() });
  await auth.signOut();
}
