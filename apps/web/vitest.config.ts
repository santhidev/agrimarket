import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Web app tests cover pure logic (admin gate, future helpers). Next.js route
// handler / RSC behavior is verified end-to-end with curl, not unit tests.
export default defineConfig({
  test: {
    include: ["app/**/*.test.ts", "lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
