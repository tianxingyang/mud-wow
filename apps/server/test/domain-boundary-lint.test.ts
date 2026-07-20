import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const domainFilePath = join(repositoryRoot, "apps/server/src/modules/combat/lint-contract.ts");
const eslint = new ESLint({ cwd: repositoryRoot });

async function lintDomainModule(source: string) {
  const [result] = await eslint.lintText(source, { filePath: domainFilePath });

  if (result === undefined) {
    throw new Error("ESLint returned no result for the domain contract fixture.");
  }

  return result;
}

describe("domain lint boundaries", () => {
  it.each([
    ["PostgreSQL driver", 'import "pg";'],
    ["HTTP framework", 'import "fastify";'],
    ["WebSocket adapter", 'import "ws";'],
    ["Node HTTP primitive", 'import "node:http";'],
    ["Node timer primitive", 'import "node:timers/promises";'],
    ["Node process primitive", 'import "node:process";'],
  ])("rejects a %s import", async (_label, source) => {
    const result = await lintDomainModule(source);

    expect(result.messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "no-restricted-imports" })]),
    );
  });

  it.each([
    ["dynamic imports", 'export const load = () => import("pg");'],
    ["CommonJS require", 'export const driver = require("pg");'],
  ])("rejects %s that bypass static import checks", async (_label, source) => {
    const result = await lintDomainModule(source);

    expect(result.messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "no-restricted-syntax" })]),
    );
  });

  it.each([
    ["system time", "export const value = Date.now();", "no-restricted-properties"],
    ["ambient randomness", "export const value = Math.random();", "no-restricted-properties"],
    [
      "ambient configuration",
      "export const value = process.env.NODE_ENV;",
      "no-restricted-properties",
    ],
    [
      "timeout scheduling",
      "export const value = setTimeout(() => undefined, 1);",
      "no-restricted-globals",
    ],
    [
      "interval scheduling",
      "export const value = setInterval(() => undefined, 1);",
      "no-restricted-globals",
    ],
    [
      "ambient HTTP",
      'export const value = fetch("https://example.invalid");',
      "no-restricted-globals",
    ],
    [
      "ambient WebSocket",
      'export const value = new WebSocket("ws://example.invalid");',
      "no-restricted-globals",
    ],
    [
      "globalThis timeout scheduling",
      "export const value = globalThis.setTimeout(() => undefined, 1);",
      "no-restricted-syntax",
    ],
    [
      "globalThis system time",
      "export const value = globalThis.Date.now();",
      "no-restricted-syntax",
    ],
    [
      "globalThis ambient randomness",
      "export const value = globalThis.Math.random();",
      "no-restricted-syntax",
    ],
    [
      "globalThis ambient configuration",
      "export const value = globalThis.process.env.NODE_ENV;",
      "no-restricted-syntax",
    ],
  ])("rejects %s", async (_label, source, ruleId) => {
    const result = await lintDomainModule(source);

    expect(result.messages).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId })]));
  });

  it("accepts time and randomness supplied through ports", async () => {
    const result = await lintDomainModule(`
      export interface Clock {
        wallNowMs(): number;
      }

      export interface RandomSource {
        integerInclusive(minimum: number, maximum: number): number;
      }

      export function chooseAt(
        clock: Clock,
        random: RandomSource,
      ): readonly [number, number] {
        return [clock.wallNowMs(), random.integerInclusive(1, 6)];
      }
    `);

    expect(result.messages).toEqual([]);
  });

  it("keeps every declared public boundary present", () => {
    const publicEntries = [
      "apps/server/src/modules/session/public.ts",
      "apps/server/src/modules/world/public.ts",
      "apps/server/src/modules/world/character/public.ts",
      "apps/server/src/modules/world/rooms/public.ts",
      "apps/server/src/modules/world/presence/public.ts",
      "apps/server/src/modules/world/spawn/public.ts",
      "apps/server/src/modules/world/progression/public.ts",
      "apps/server/src/modules/world/rewards/public.ts",
      "apps/server/src/modules/quest/public.ts",
      "apps/server/src/modules/combat/public.ts",
    ];

    expect(publicEntries.filter((path) => !existsSync(join(repositoryRoot, path)))).toEqual([]);
  });
});
