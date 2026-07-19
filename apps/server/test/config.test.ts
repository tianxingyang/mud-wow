import { describe, expect, it } from "vitest";

import { loadServerConfig } from "../src/config";

describe("server configuration", () => {
  it("loads the database URL and local HTTP defaults", () => {
    expect(loadServerConfig({ DATABASE_URL: "postgresql://example/database" })).toEqual({
      databaseUrl: "postgresql://example/database",
      host: "127.0.0.1",
      port: 3000,
    });
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
