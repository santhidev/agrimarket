"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestOtpAction, verifyOtpAction } from "./actions";

// 2-step phone OTP login page.
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
    setBusy(true);
    const result = await requestOtpAction(phone);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.testCode) setCode(result.testCode);
    setStep("otp");
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await verifyOtpAction(phone, code);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="login">
      <div className="login__card">
        <h1 className="login__title">AgriMarket</h1>
        <p className="login__subtitle">เข้าสู่ระบบ</p>

        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}

        {step === "phone" ? (
          <form onSubmit={onRequestOtp} className="login__form">
            <label className="login__label" htmlFor="phone">
              เบอร์โทรศัพท์
            </label>
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
              <small>
                (โหมดทดสอบ: ใช้ <strong>000000</strong>)
              </small>
            </p>
            <label className="login__label" htmlFor="code">
              รหัสยืนยัน (OTP)
            </label>
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
