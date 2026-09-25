// @ts-check

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/generated/**", "**/.claude/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    ...reactPlugin.configs.flat.recommended,
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser },
    },
    settings: {
      react: { version: "detect" },
    },
  },
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    ...reactPlugin.configs.flat["jsx-runtime"],
  },
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooksPlugin },
    rules: reactHooksPlugin.configs.flat["recommended-latest"].rules,
  },
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    rules: {
      "react/prop-types": "off",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },
  eslintConfigPrettier,
);
