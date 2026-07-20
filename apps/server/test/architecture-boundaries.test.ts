import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cruise, type IConfiguration, type ICruiseResult } from "dependency-cruiser";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureRoot = join(repositoryRoot, "apps/server/test/fixtures/architecture");
const require = createRequire(import.meta.url);
const configuration = require(join(repositoryRoot, ".dependency-cruiser.cjs")) as IConfiguration;
const sourceRoots = ["apps/server/src", "apps/web/src", "packages/protocol/src"];

interface FixtureExpectation {
  readonly fixture: string;
  readonly moduleCount: number;
  readonly rules: readonly string[];
}

async function cruiseFixture(fixture: string): Promise<ICruiseResult> {
  const baseDir = join(fixtureRoot, fixture);
  const fixtureSources = sourceRoots.filter((sourceRoot) => existsSync(join(baseDir, sourceRoot)));

  if (!configuration.forbidden) {
    throw new TypeError("Architecture configuration must define forbidden rules.");
  }

  const result = await cruise(fixtureSources, {
    ...configuration.options,
    baseDir,
    ruleSet: { forbidden: configuration.forbidden },
    validate: true,
  });

  if (typeof result.output === "string") {
    throw new TypeError("Expected dependency-cruiser to return a structured result.");
  }

  return result.output;
}

function uniqueRuleNames(result: ICruiseResult): string[] {
  return [...new Set(result.summary.violations.map((violation) => violation.rule.name))].sort();
}

describe("architecture import boundaries", () => {
  it.each<FixtureExpectation>([
    { fixture: "unresolved", moduleCount: 2, rules: ["no-unresolved"] },
    { fixture: "circular", moduleCount: 2, rules: ["no-circular"] },
    { fixture: "web-server", moduleCount: 2, rules: ["web-no-server"] },
    { fixture: "protocol-app", moduleCount: 2, rules: ["protocol-no-apps"] },
    {
      fixture: "gateway-domain",
      moduleCount: 2,
      rules: ["gateway-no-application-domain-or-infrastructure"],
    },
    {
      fixture: "gateway-kernel",
      moduleCount: 2,
      rules: ["gateway-no-kernel-client-or-root-internals"],
    },
    {
      fixture: "gateway-client",
      moduleCount: 2,
      rules: ["gateway-no-kernel-client-or-root-internals"],
    },
    {
      fixture: "runtime-domain",
      moduleCount: 2,
      rules: ["runtime-session-public-only"],
    },
    {
      fixture: "runtime-transport",
      moduleCount: 2,
      rules: ["runtime-no-gateway-transport-or-root-internals"],
    },
    {
      fixture: "deep-import",
      moduleCount: 2,
      rules: ["application-domain-public-only"],
    },
    {
      fixture: "domain-infrastructure",
      moduleCount: 2,
      rules: ["only-composition-root-may-import-infrastructure"],
    },
    {
      fixture: "application-runtime",
      moduleCount: 2,
      rules: ["application-no-runtime"],
    },
    {
      fixture: "application-transport",
      moduleCount: 2,
      rules: ["application-no-gateway-transport-or-root-internals"],
    },
    {
      fixture: "kernel-domain",
      moduleCount: 2,
      rules: ["kernel-no-outer-layers"],
    },
    {
      fixture: "domain-root",
      moduleCount: 2,
      rules: ["domain-no-root-internals"],
    },
    {
      fixture: "infrastructure-gateway",
      moduleCount: 2,
      rules: ["infrastructure-no-gateway-transport-or-root-internals"],
    },
    {
      fixture: "infrastructure-transport",
      moduleCount: 2,
      rules: ["infrastructure-no-gateway-transport-or-root-internals"],
    },
    {
      fixture: "root-domain",
      moduleCount: 2,
      rules: ["server-root-no-concrete-layers"],
    },
    {
      fixture: "world-sibling",
      moduleCount: 2,
      rules: ["world-character-no-sibling-imports"],
    },
    {
      fixture: "world-root-deep-import",
      moduleCount: 2,
      rules: ["world-root-child-public-only"],
    },
    {
      fixture: "world-child-root-deep-import",
      moduleCount: 2,
      rules: ["world-child-root-public-only"],
    },
    {
      fixture: "combat-sealed",
      moduleCount: 2,
      rules: ["combat-sealed-no-external", "server-root-no-concrete-layers"],
    },
    {
      fixture: "infrastructure-domain-deep",
      moduleCount: 2,
      rules: ["infrastructure-domain-ports-only"],
    },
  ])("rejects $fixture with its exact boundary rule", async ({ fixture, moduleCount, rules }) => {
    const result = await cruiseFixture(fixture);

    expect(result.summary.totalCruised).toBe(moduleCount);
    expect(uniqueRuleNames(result)).toEqual([...rules].sort());
  });

  it.each([
    ["valid-public-import", 2],
    ["valid-composition-root", 2],
    ["valid-world-group-import", 2],
    ["valid-world-child-port", 2],
    ["valid-world-root-public", 2],
    ["valid-runtime-public-imports", 3],
  ])("accepts the legal dependency graph in %s", async (fixture, moduleCount) => {
    const result = await cruiseFixture(fixture);

    expect(result.summary.totalCruised).toBe(moduleCount);
    expect(result.summary.violations).toEqual([]);
  });
});
