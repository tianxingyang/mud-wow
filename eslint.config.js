import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/server/**/*.ts", "apps/web/vite.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["apps/server/src/modules/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "setTimeout",
          message: "Domain modules must use an injected scheduler port.",
        },
        {
          name: "setInterval",
          message: "Domain modules must use an injected scheduler port.",
        },
        {
          name: "fetch",
          message: "Domain modules must use an injected HTTP port.",
        },
        {
          name: "WebSocket",
          message: "Domain modules must use an injected messaging port.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            "pg",
            "fastify",
            "ws",
            "http",
            "node:http",
            "https",
            "node:https",
            "http2",
            "node:http2",
            "timers",
            "node:timers",
            "timers/promises",
            "node:timers/promises",
            "process",
            "node:process",
          ],
          patterns: ["pg/*", "fastify/*", "@fastify/*", "ws/*"],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Date",
          property: "now",
          message: "Domain modules must use an injected Clock port.",
        },
        {
          object: "Math",
          property: "random",
          message: "Domain modules must use an injected RandomSource port.",
        },
        {
          object: "process",
          property: "env",
          message: "Domain modules must receive configuration through ports.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message:
            "Domain modules must use static imports so architecture checks can inspect dependencies.",
        },
        {
          selector: "CallExpression[callee.name='require']",
          message:
            "Domain modules must use static ESM imports so architecture checks can inspect dependencies.",
        },
        {
          selector:
            "MemberExpression[object.name='globalThis'][property.name='setTimeout'], MemberExpression[object.name='globalThis'][property.name='setInterval']",
          message: "Domain modules must use an injected scheduler port.",
        },
        {
          selector:
            "MemberExpression[object.name='globalThis'][property.name='fetch'], MemberExpression[object.name='globalThis'][property.name='WebSocket']",
          message: "Domain modules must use injected transport ports.",
        },
        {
          selector:
            "MemberExpression[object.object.name='globalThis'][object.property.name='Date'][property.name='now']",
          message: "Domain modules must use an injected Clock port.",
        },
        {
          selector:
            "MemberExpression[object.object.name='globalThis'][object.property.name='Math'][property.name='random']",
          message: "Domain modules must use an injected RandomSource port.",
        },
        {
          selector:
            "MemberExpression[object.object.name='globalThis'][object.property.name='process'][property.name='env']",
          message: "Domain modules must receive configuration through ports.",
        },
      ],
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
);
