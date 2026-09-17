import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createContentReadinessProbe } from "../src/infrastructure/content/content-readiness";
import { loadContent } from "../src/infrastructure/content/load-content";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "mud-wow-content-readiness-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("content readiness", () => {
  it("reports the loaded opaque content version", async () => {
    const manifestUrl = new URL("../../../content/northshire-v1/manifest.json", import.meta.url);
    const probe = createContentReadinessProbe(loadContent(manifestUrl));

    await expect(probe()).resolves.toEqual({
      ready: true,
      checks: { content: "loaded", content_version: "northshire-v1-m0" },
    });
  });

  it("reports a missing manifest without exposing its path", async () => {
    const secretPath = join(createTemporaryDirectory(), "customer-secret", "manifest.json");
    const probe = createContentReadinessProbe(loadContent(secretPath));

    const result = await probe();

    expect(result).toEqual({
      ready: false,
      checks: { content: "missing", content_version: "unknown" },
    });
    expect(JSON.stringify(result)).not.toContain("customer-secret");
  });

  it("reports invalid content without exposing source data or validation details", async () => {
    const directory = createTemporaryDirectory();
    const manifestPath = join(directory, "manifest.json");
    writeFileSync(manifestPath, '{"database_password":"do-not-leak"}', "utf8");
    const probe = createContentReadinessProbe(loadContent(manifestPath));

    const firstResult = await probe();
    const secondResult = await probe();

    expect(firstResult).toEqual({
      ready: false,
      checks: { content: "invalid", content_version: "unknown" },
    });
    expect(JSON.stringify(firstResult)).not.toContain("do-not-leak");
    expect(firstResult).toBe(secondResult);
    expect(Object.isFrozen(firstResult)).toBe(true);
    expect(Object.isFrozen(firstResult.checks)).toBe(true);
  });
});
