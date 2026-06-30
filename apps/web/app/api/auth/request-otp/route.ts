import { NextResponse } from "next/server";
import { OtpService } from "@agrimarket/database";
import { requestOtpSchema } from "@agrimarket/shared";

// POST /api/auth/request-otp
// Accepts { phone }, generates + stores an OTP in Redis (TTL 5 min).
// In test mode (default dev), returns the code so the UI can display it.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = requestOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { phone } = parsed.data;
  const code = await OtpService.generate(phone);

  // MVP: no real SMS gateway. In production (OTP_TEST_MODE=false) the code is
  // delivered via SMS (stubbed here — would integrate Tweway/others later).
  const testMode = process.env.OTP_TEST_MODE !== "false";

  return NextResponse.json({
    expiresIn: 300,
    // Only expose the code to clients in test mode (no SMS available).
    ...(testMode ? { testCode: code } : {}),
  });
}
