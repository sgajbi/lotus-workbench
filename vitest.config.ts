import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: [
        "src/apps/**/*.ts",
        "src/apps/**/*.tsx",
        "src/design-system/**/*.ts",
        "src/design-system/**/*.tsx",
        "src/features/**/*.ts",
        "src/features/**/*.tsx",
        "src/shell/**/*.ts",
        "src/shell/**/*.tsx",
        "src/app/**/*.ts",
        "src/app/**/*.tsx",
      ],
      exclude: [
        "tests/**",
        "**/*.d.ts",
        "**/*.config.*",
        ".next/**",
        "coverage/**",
        "node_modules/**",
      ],
      thresholds: {
        lines: 86,
        statements: 86,
        functions: 93.47,
        branches: 74,
      },
    },
  },
});
