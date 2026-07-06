"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, Shield, TrendingUp, Zap } from "lucide-react";
import { requestOtpAction, verifyOtpAction } from "./actions";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";

// Split-screen phone OTP login. Two steps share one screen:
//   phone → request OTP → otp → verify → redirect to /dashboard.
// Logic preserved exactly: testCode auto-fill, error surfacing, router flow.
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // OTP digit boxes state — 6 separate one-char inputs with auto-advance.
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

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

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setCode(next.join(""));
    if (clean && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function onDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  // Phone formatted for display on the OTP step.
  const phoneDisplay = phone ? `0${phone}`.slice(-10) : "081-234-5678";
  const otpComplete = digits.every((d) => d !== "");

  return (
    <div className="flex min-h-screen">
      {/* Left hero panel */}
      <aside
        className="hidden md:flex flex-col justify-between w-[55%] relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #388E3C 100%)",
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&h=700&fit=crop&auto=format"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 p-12">
          <div className="flex items-center gap-2">
            <span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Leaf size={20} className="text-white" />
            </span>
            <span className="text-white font-bold text-xl">AgriMarket</span>
          </div>
        </div>
        <div className="relative z-10 p-12 pb-16">
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            ตลาดขายตรง
            <br />
            ตัดพ่อค้าคนกลาง
          </h1>
          <p className="text-green-100 text-lg mb-10">
            เชื่อมเกษตรกรและผู้ซื้อโดยตรง ได้ราคาดี ของสด ทุกวัน
          </p>
          <div className="space-y-5">
            {[
              { icon: TrendingUp, title: "ขายได้ราคาดีกว่า", desc: "ไม่ผ่านพ่อค้าคนกลาง ราคาตลาดจริง" },
              { icon: Leaf, title: "ได้ของสดจากสวน", desc: "เชื่อมตรงกับเกษตรกร สินค้าสดใหม่" },
              { icon: Zap, title: "ตัดขั้นตอนยุ่งยาก", desc: "ประกาศ → เสนอ → จับคู่ ง่ายๆ" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-4">
                <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-white" />
                </span>
                <div>
                  <p className="text-white font-semibold">{title}</p>
                  <p className="text-green-100 text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Right form panel */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 bg-white">
        <div className="w-full max-w-sm">
          {error && (
            <p
              role="alert"
              className="mb-4 px-3 py-2 bg-[#ffeeee] text-error rounded-lg text-sm text-center"
            >
              {error}
            </p>
          )}

          {step === "phone" ? (
            <>
              <div className="md:hidden flex items-center gap-2 mb-6">
                <Leaf size={20} className="text-green-600" />
                <span className="font-bold text-green-600 text-lg">AgriMarket</span>
              </div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-ink mb-1">เข้าสู่ระบบ / สมัครสมาชิก</h2>
                <p className="text-muted text-sm">กรอกเบอร์มือถือเพื่อรับรหัส OTP</p>
              </div>

              <form onSubmit={onRequestOtp} className="space-y-4">
                <Input
                  id="phone"
                  label="เบอร์มือถือ"
                  prefix="+66"
                  placeholder="81-234-5678"
                  value={phone}
                  onChange={setPhone}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                />

                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? "กำลังส่ง..." : "ขอรหัส OTP"}
                </Button>

                <p className="text-center text-xs text-muted">
                  การเข้าสู่ระบบถือว่าคุณยอมรับ{" "}
                  <a href="#" className="text-green-600 underline">
                    เงื่อนไขการใช้บริการ
                  </a>
                </p>

                <div className="bg-accent-light border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-700 font-medium">
                    💡 ทดลองใช้งาน: OTP = <strong>000000</strong>
                  </p>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center mb-8">
                <span className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-100 flex items-center justify-center mb-4">
                  <Shield size={28} className="text-green-600" />
                </span>
                <h2 className="text-2xl font-bold text-ink mb-1">กรอกรหัส 6 หลัก</h2>
                <p className="text-muted text-sm text-center">
                  ส่งรหัสไปยัง <strong>{phoneDisplay}</strong>{" "}
                  <button
                    type="button"
                    className="text-green-600 underline"
                    onClick={() => {
                      setStep("phone");
                      setCode("");
                      setDigits(["", "", "", "", "", ""]);
                      setError(null);
                    }}
                  >
                    แก้ไขเบอร์
                  </button>
                </p>
              </div>

              <form onSubmit={onVerify}>
                <div className="flex gap-2.5 justify-center mb-6">
                  {digits.map((v, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      maxLength={1}
                      value={v}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => onDigitKeyDown(i, e)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label={`หลักที่ ${i + 1}`}
                      className="w-11 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none focus:border-green-600 transition-colors bg-surface"
                      style={{ borderColor: v ? "#2E7D32" : "rgba(0,0,0,0.08)" }}
                    />
                  ))}
                </div>

                <p className="text-center text-sm text-muted mb-5">
                  ส่งรหัสอีกครั้งใน <strong className="text-ink">00:58</strong>
                </p>

                <Button type="submit" size="lg" className="w-full" disabled={busy || !otpComplete}>
                  {busy ? "กำลังเข้าสู่ระบบ..." : "ยืนยัน"}
                </Button>

                <div className="mt-4 bg-accent-light border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-700 font-medium">
                    💡 ทดลองใช้งาน: OTP = <strong>000000</strong>
                  </p>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
