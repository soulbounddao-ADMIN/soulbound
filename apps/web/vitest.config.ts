import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: [
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
    ],
    exclude: ["**/*.integration.test.ts", ".next/**"],
  },
});
