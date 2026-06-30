"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

// Server action: drives the Auth.js Credentials sign-in. Called from the
// login page after the user enters phone + OTP code.
export async function loginWithOtp(phone: string, code: string) {
  try {
    await signIn("credentials", {
      phone,
      code,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "รหัสยืนยันไม่ถูกต้องหรือหมดอายุ" };
    }
    throw error; // rethrow redirect errors (Next.js uses throws for redirects)
  }
}
