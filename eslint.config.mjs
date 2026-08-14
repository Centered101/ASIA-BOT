import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    // ASIA-BOT-main-Demo is the old static-HTML predecessor, kept for reference only.
    // QQ/Qman sql + images are data, not source.
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-test/**",
      "ASIA-BOT-main-Demo/**",
      "public/**",
      "arduino/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    linterOptions: {
      // Many rules below are "warn", which makes ESLint consider existing
      // eslint-disable comments "unused" and strip them on --fix. Those
      // suppressions are deliberate, so leave them alone.
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      // The codebase predates linting (~40k LOC). These stay as warnings so CI
      // reports them without blocking; tighten to "error" module by module as
      // each area is migrated to the shared server layer.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
    },
  },
  {
    // New shared server layer is held to a higher standard from day one.
    files: ["src/lib/server/**/*.ts", "src/lib/rbac/**/*.ts", "src/lib/modules/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];

export default eslintConfig;
