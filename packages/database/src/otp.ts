import { randomInt } from "node:crypto";
import { redis } from "./redis";

const TEST_CODE = "000000";
const DEFAULT_TTL_SECONDS = 300; // 5 minutes
const DEFAULT_MAX_ATTEMPTS = 5;

const isTestMode = (): boolean =>
  process.env.OTP_TEST_MODE !== "false"; // default true unless explicitly disabled

const codeKey = (phone: string) => `otp:${phone}`;
const attemptsKey = (phone: string) => `otp:attempts:${phone}`;

/**
 * OTP (one-time password) service backed by Redis.
 *
 * Storage (per redis-core skill — String type, colon-separated keys):
 *   otp:{phone}          → the 6-digit code, TTL 5 min
 *   otp:attempts:{phone} → failed-verify counter, TTL 5 min
 *
 * In test mode (default in dev), every code is the literal `000000` so the
 * PRD acceptance criteria ("Test mode OTP 000000 always succeeds") holds.
 */
export const OtpService = {
  /**
   * Generate + store an OTP for `phone`, overwriting any previous code.
   * Returns the code (test mode returns `000000`).
   */
  async generate(phone: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<string> {
    const code = isTestMode() ? TEST_CODE : randomCode(6);

    await redis.set(codeKey(phone), code, "EX", ttlSeconds);
    // Reset the failed-attempt counter on a fresh code.
    await redis.del(attemptsKey(phone));

    return code;
  },

  /**
   * Verify `code` against the stored OTP for `phone`. Consumes the code on
   * success. Returns false if the code is wrong, expired, or already consumed.
   * After `maxAttempts` wrong tries the stored code is invalidated.
   */
  async verify(
    phone: string,
    code: string,
    opts: { maxAttempts?: number } = {}
  ): Promise<boolean> {
    if (!code) return false;

    const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const stored = await redis.get(codeKey(phone));

    if (stored === null) {
      // Expired or never issued.
      return false;
    }

    if (!fixedTimeEquals(stored, code)) {
      const attempts = await redis.incr(attemptsKey(phone));
      // Keep the attempt counter's TTL aligned with the code's.
      await redis.expire(attemptsKey(phone), DEFAULT_TTL_SECONDS);
      if (attempts >= maxAttempts) {
        // Brute-force protection: invalidate the code.
        await redis.del(codeKey(phone));
        await redis.del(attemptsKey(phone));
      }
      return false;
    }

    // Success: consume the code + clear attempts.
    await redis.del(codeKey(phone));
    await redis.del(attemptsKey(phone));
    return true;
  },
};

function randomCode(length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += randomInt(0, 10).toString();
  }
  return code;
}

/// Constant-time string comparison to avoid timing side-channels.
function fixedTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
