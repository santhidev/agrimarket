"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithOtp } from "./actions";
import { requestOtpSchema } from "@agrimarket/shared";

// 2-step phone OTP login page.
// Step 1: enter phone → request OTP (POST /api/auth/request-otp).
// Step 2: enter OTP → loginWithOtp server action → Auth.js signIn.
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = requestOtpSchema.safeParse({ phone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "เบอร์โทรศัพท์ไม่ถูกต้อง");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as { testCode?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "ขอรหัสยืนยันไม่สำเร็จ");
        return;
      }
      // In test mode the server returns the code — pre-fill for convenience.
      if (data.testCode) setCode(data.testCode);
      setStep("otp");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await loginWithOtp(phone, code);
      if (result?.error) {
        setError(result.error);
        setBusy(false);
        return;
      }
      // signIn redirects on success — the throw above navigates.
      router.refresh();
    } catch {
      setError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login__card">
        <h1 className="login__title">AgriMarket</h1>
        <p className="login__subtitle">เข้าสู่ระบบ</p>

        {error && <p className="login__error" role="alert">{error}</p>}

        {step === "phone" ? (
          <form onSubmit={onRequestOtp} className="login__form">
            <label className="login__label" htmlFor="phone">เบอร์โทรศัพท์</label>
            <input
              id="phone"
              className="login__input"
              type="tel"
              inputMode="numeric"
              placeholder="0812345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              required
            />
            <button type="submit" className="login__btn" disabled={busy}>
              {busy ? "กำลังส่ง..." : "ขอรหัสยืนยัน"}
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="login__form">
            <p className="login__hint">
              กรอกรหัสยืนยัน 6 หลัก
              <br />
              <small>(โหมดทดสอบ: ใช้ <strong>000000</strong>)</small>
            </p>
            <label className="login__label" htmlFor="code">รหัสยืนยัน (OTP)</label>
            <input
              id="code"
              className="login__input login__input--code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button type="submit" className="login__btn" disabled={busy}>
              {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
            <button
              type="button"
              className="login__link"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
            >
              ย้อนกลับ
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
