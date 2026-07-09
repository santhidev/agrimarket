import type { Page } from "@playwright/test";
import { createClient } from "@insforge/sdk";
import { INSFORGE } from "../fixtures/test-ids";

// Request an OTP via the edge function and return the testCode (dev mode).
// The UI's requestOtpAction calls the same edge function via a server action,
// but Playwright can't see the server action's return value — so we call the
// edge function directly to capture testCode, then type it into the UI.
//
// Note: the login page's onRequestOtp also stores testCode in React `code`
// state, but that does NOT populate the visible 6 digit boxes (the `digits`
// array stays empty), so the submit button stays disabled (otpComplete gate).
// We therefore type each digit into the boxes — that both fills the UI and
// re-derives `code` via setDigit → setCode(next.join("")).
export async function requestOtpCode(phone: string): Promise<string> {
  const client = createClient({
    baseUrl: INSFORGE.url,
    anonKey: INSFORGE.anonKey,
  });
  const { data, error } = await client.functions.invoke("phone-otp", {
    body: { action: "request", phone },
  });
  if (error) {
    throw new Error(`OTP request failed for ${phone}: ${error.message}`);
  }
  const code = (data as { testCode?: string }).testCode;
  if (!code) {
    throw new Error(`No testCode returned for ${phone} — is dev mode on?`);
  }
  return code;
}

// Full login flow via the UI: navigate to /login, type phone, request OTP,
// type the code into the 6 digit boxes, submit, wait for dashboard redirect.
//
// Selectors mirror apps/web/app/login/page.tsx:
//   - phone input: <Input id="phone" label="เบอร์มือถือ" prefix="+66" />
//   - phone submit button: "ขอรหัส OTP" (busy: "กำลังส่ง...")
//   - OTP: six <input maxLength={1} aria-label="หลักที่ N" />
//   - verify button: "ยืนยัน" (busy: "กำลังเข้าสู่ระบบ..."), disabled until full
//   - success: router.push("/dashboard")
//
// The phone field carries a "+66" prefix and login expects the mobile WITHOUT
// a leading 0 (e.g. "812345678"); normalizePhone() in the server action
// re-adds the 0. We pass the TEST phone (0xxxxxxxxx) and rely on that
// normalization, so the value matches the user the edge function creates.
export async function loginViaUi(page: Page, phone: string): Promise<void> {
  await page.goto("/login");

  // Phone step — type the phone, then request the OTP.
  await page.getByLabel("เบอร์มือถือ").fill(phone);
  await page.getByRole("button", { name: "ขอรหัส OTP" }).click();

  // OTP step — capture the testCode via the edge function, then type each
  // digit into its box. maxLength={1} renders as the HTML maxlength attribute.
  const code = await requestOtpCode(phone);
  const digitInputs = page.locator("input[maxlength='1']");
  await digitInputs.first().waitFor();
  for (let i = 0; i < code.length; i++) {
    await digitInputs.nth(i).fill(code[i]);
  }

  // Submit + wait for redirect to /dashboard.
  await page.getByRole("button", { name: "ยืนยัน" }).click();
  await page.waitForURL("**/dashboard");
}
