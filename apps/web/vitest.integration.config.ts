import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["app/**/*.integration.test.ts"],
    exclude: [".next/**"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
