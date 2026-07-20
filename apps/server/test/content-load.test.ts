import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadContent } from "../src/infrastructure/content/load-content";

const temporaryDirectories: string[] = [];

function writeTemporaryManifest(source: string): string {
  const directory = mkdtempSync(join(tmpdir(), "mud-wow-content-"));
  const manifestPath = join(directory, "manifest.json");
  temporaryDirectories.push(directory);
  writeFileSync(manifestPath, source, "utf8");
  return manifestPath;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("content loader", () => {
  it("loads the real M0 manifest in an ordinary test", () => {
    const manifestUrl = new URL("../../../content/northshire-v1/manifest.json", import.meta.url);
    const result = loadContent(manifestUrl);

    expect(result.status).toBe("loaded");
    if (result.status !== "loaded") {
      throw new Error("Expected the repository content manifest to load");
    }

    expect(result.snapshot).toEqual({
      contentVersion: "northshire-v1-m0",
      records: [],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.snapshot)).toBe(true);
    expect(Object.isFrozen(result.snapshot.records)).toBe(true);
  });

  it("returns missing without throwing when the manifest does not exist", () => {
    const directory = mkdtempSync(join(tmpdir(), "mud-wow-content-"));
    temporaryDirectories.push(directory);

    expect(loadContent(join(directory, "missing.json"))).toEqual({ status: "missing" });
  });

  it("returns invalid without exposing JSON or Schema errors", () => {
    const malformedPath = writeTemporaryManifest("{not-json");
    const invalidSchemaPath = writeTemporaryManifest(
      JSON.stringify({ content_version: "northshire-v1-m0", records: [{ secret: "hidden" }] }),
    );

    expect(loadContent(malformedPath)).toEqual({ status: "invalid" });
    expect(loadContent(invalidSchemaPath)).toEqual({ status: "invalid" });
  });

  it("keeps a frozen snapshot unchanged after its source file changes", () => {
    const manifestPath = writeTemporaryManifest(
      JSON.stringify({
        content_version: "opaque-baseline",
        records: [
          {
            id: "npc_deputy_willem",
            content_type: "npc",
            source_id: 823,
            source_version: "vanilla_1_12",
            source_urls: ["https://example.com/npc/823"],
            canonical_status: "adapted",
            adaptation_notes: ["Uses shortened text dialogue."],
            content_version: "opaque-baseline",
          },
        ],
      }),
    );

    const result = loadContent(manifestPath);
    writeFileSync(
      manifestPath,
      readFileSync(manifestPath, "utf8").replaceAll("opaque-baseline", "changed-version"),
      "utf8",
    );

    expect(result.status).toBe("loaded");
    if (result.status !== "loaded") {
      throw new Error("Expected fixture content to load");
    }

    expect(result.snapshot.contentVersion).toBe("opaque-baseline");
    expect(Object.isFrozen(result.snapshot.records[0])).toBe(true);
    expect(Object.isFrozen(result.snapshot.records[0]?.source_urls)).toBe(true);
    expect(Object.isFrozen(result.snapshot.records[0]?.adaptation_notes)).toBe(true);
  });
});
