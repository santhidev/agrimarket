import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use distinct phones per test to avoid Redis key collisions when running
    // against the shared docker Redis (integration tests).
    include: ["__tests__/**/*.test.ts"],
    // Load .env (REDIS_URL, OTP_TEST_MODE) before tests run.
    setupFiles: ["__tests__/setup.ts"],
  },
});
