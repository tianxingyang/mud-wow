import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadServerConfig } from "../src/config";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));

describe("server configuration", () => {
  it("loads the database URL and local HTTP defaults", () => {
    expect(loadServerConfig({ DATABASE_URL: "postgresql://example/database" })).toEqual({
      databaseUrl: "postgresql://example/database",
      contentPath: resolve(repositoryRoot, "content/northshire-v1/manifest.json"),
      host: "127.0.0.1",
      port: 3000,
    });
  });

  it("resolves a relative content path from the repository root", () => {
    expect(
      loadServerConfig({
        DATABASE_URL: "postgresql://example/database",
        CONTENT_PATH: "tests/fixtures/content",
      }).contentPath,
    ).toBe(resolve(repositoryRoot, "tests/fixtures/content"));
  });

  it("rejects a missing database URL", () => {
    expect(() => loadServerConfig({})).toThrow("DATABASE_URL is required");
  });

  it("rejects an invalid port", () => {
    expect(() =>
      loadServerConfig({
        DATABASE_URL: "postgresql://example/database",
        PORT: "70000",
      }),
    ).toThrow("PORT must be an integer between 1 and 65535");
  });
});
