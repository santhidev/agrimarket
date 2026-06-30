import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    // shared currently has no unit tests of its own (schemas are tested via
    // apps/web). Don't fail when no test files match.
    passWithNoTests: true,
  },
});
