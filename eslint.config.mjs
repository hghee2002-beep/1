import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

import noClientServerEnv from "./eslint-rules/no-client-server-env.mjs";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    plugins: {
      "deluxe-boundaries": {
        rules: {
          "no-client-server-env": noClientServerEnv,
        },
      },
    },
    rules: {
      "deluxe-boundaries/no-client-server-env": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  globalIgnores([
    ".next/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "src/generated/prisma/**",
  ]),
]);
