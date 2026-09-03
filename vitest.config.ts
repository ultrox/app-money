import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: false,
    reporters: process.env["GITHUB_ACTIONS"] ? ["default", "github-actions"] : ["default"],
    coverage: {
      provider: "v8",
      include: [
        "src/index.ts",
        "src/money.effect.ts",
        "src/money.ts",
        "src/result.ts",
        "src/wire.ts",
      ],
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      thresholds: {
        statements: 99,
        branches: 95,
        functions: 100,
        lines: 100,
      },
    },
  },
});
