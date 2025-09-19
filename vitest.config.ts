import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
