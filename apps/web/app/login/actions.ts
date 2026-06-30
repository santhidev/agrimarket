"use server";

import { cookies } from "next/headers";
import { createAuthActions, createBrowserClient } from "@insforge/sdk/ssr";
import { requestOtpSchema, verifyOtpSchema } from "@agrimarket/shared";

// Phone OTP auth — server actions.
// Flow: requestOtp → user enters code → verifyOtp (calls edge function) →
// signInWithPassword (establishes InsForge session in cookies).

export async function requestOtpAction(phone: string) {
  const parsed = requestOtpSchema.safeParse({ phone });
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
  const parsed = verifyOtpSchema.safeParse({ phone, code });
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
  // The edge function created the user with a deterministic password derived
  // from the phone number — never user-facing; OTP is the real gate.
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
