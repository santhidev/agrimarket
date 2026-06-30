import { describe, it, expect, beforeAll } from "vitest";
import { OtpService } from "../src/otp";

// Integration tests against the docker Redis (assumes `docker compose up -d`).
// Each test uses a distinct phone so order doesn't matter.
describe("OtpService (Redis-backed)", () => {
  beforeAll(() => {
    // Default to test mode so 000000 is deterministic.
    process.env.OTP_TEST_MODE = "true";
  });

  it("generates 000000 in test mode", async () => {
    const code = await OtpService.generate("0800000001");
    expect(code).toBe("000000");
  });

  it("verifies the correct code", async () => {
    await OtpService.generate("0800000002");
    const ok = await OtpService.verify("0800000002", "000000");
    expect(ok).toBe(true);
  });

  it("consumes the code after a successful verify", async () => {
    await OtpService.generate("0800000003");
    await OtpService.verify("0800000003", "000000");
    const second = await OtpService.verify("0800000003", "000000");
    expect(second).toBe(false);
  });

  it("rejects a wrong code", async () => {
    await OtpService.generate("0800000004");
    const ok = await OtpService.verify("0800000004", "123456");
    expect(ok).toBe(false);
  });

  it("fails when no code was issued", async () => {
    const ok = await OtpService.verify("0800000099", "000000");
    expect(ok).toBe(false);
  });

  it("fails for empty/null code", async () => {
    await OtpService.generate("0800000005");
    expect(await OtpService.verify("0800000005", "")).toBe(false);
    expect(await OtpService.verify("0800000005", "")).toBe(false);
  });

  it("invalidates the code after max attempts", async () => {
    await OtpService.generate("0800000006");
    // Fail 5 times (default maxAttempts).
    for (let i = 0; i < 5; i++) {
      await OtpService.verify("0800000006", "111111");
    }
    // Even the correct code no longer works — it was invalidated.
    const ok = await OtpService.verify("0800000006", "000000");
    expect(ok).toBe(false);
  });
});
