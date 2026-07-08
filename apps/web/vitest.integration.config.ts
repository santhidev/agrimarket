import { defineConfig } from "vitest/config";

// Integration test config (Issue 17). Separate from the default vitest config
// because these tests need a running dev server + a real InsForge backend
// (NOT part of the turbo `pnpm test` pipeline). Run manually:
//   pnpm --filter @agrimarket/web test:integration
// Full live wiring + CI harness is deferred to Issue 19 (E2E happy path).

export default defineConfig({
  test: {
    include: ["tests/**/*.integration.test.ts"],
    environment: "node",
    testTimeout: 30000,
  },
});
