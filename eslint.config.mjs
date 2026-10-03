import nextPlugin from "@lotus/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

import {
  NEXT_DEVELOPMENT_DIRECTORY,
  NEXT_PRODUCTION_DIRECTORY,
} from "./scripts/config/next-artifact-layout.mjs";

const stableReactHooksRules = {
  "react-hooks/rules-of-hooks":
    reactHooks.configs.recommended.rules["react-hooks/rules-of-hooks"],
  "react-hooks/exhaustive-deps":
    reactHooks.configs.recommended.rules["react-hooks/exhaustive-deps"],
};

const intentionalUnusedValuePattern = "^_";

const sharedJavaScriptRuntimeGlobals = {
  AbortController: "readonly",
  Blob: "readonly",
  Buffer: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  crypto: "readonly",
  fetch: "readonly",
  FormData: "readonly",
  Headers: "readonly",
  performance: "readonly",
  process: "readonly",
  queueMicrotask: "readonly",
  Request: "readonly",
  Response: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  TextDecoder: "readonly",
  TextEncoder: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
};

export default [
  {
    ignores: [
      ".next/**",
      `${NEXT_DEVELOPMENT_DIRECTORY}/**`,
      `${NEXT_PRODUCTION_DIRECTORY}/**`,
      "coverage/**",
      "node_modules/**",
      "tools/eslint-plugin-next/dist/**",
      "output/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: intentionalUnusedValuePattern,
          caughtErrors: "all",
          caughtErrorsIgnorePattern: intentionalUnusedValuePattern,
          destructuredArrayIgnorePattern: intentionalUnusedValuePattern,
          varsIgnorePattern: intentionalUnusedValuePattern,
        },
      ],
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      globals: sharedJavaScriptRuntimeGlobals,
    },
    rules: {
      "no-undef": "error",
    },
  },
  {
    files: ["src/**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...stableReactHooksRules,
    },
    settings: {
      next: {
        rootDir: ".",
      },
    },
  },
];
