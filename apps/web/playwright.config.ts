import { defineConfig, devices } from "@playwright/test";

// E2E config (Issue 19). Separate from vitest — Playwright has its own runner.
// NOT part of the turbo `pnpm test` pipeline; run explicitly via `pnpm test:e2e`.

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // single happy path — no parallelism
  retries: 0, // flake must be fixed, not retried
  workers: 1, // shared backend state
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/fixtures/global-setup.ts",
  globalTeardown: "./e2e/fixtures/global-teardown.ts",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // No webServer auto-start — globalSetup verifies the server is up.
});
