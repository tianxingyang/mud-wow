import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { composeApplication } from "../src/composition-root";

describe("application composition", () => {
  it("starts but stays unready when the content manifest is missing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "mud-wow-missing-content-"));
    const application = composeApplication({
      databaseUrl: "postgresql://unused:unused@127.0.0.1:1/mud_wow",
      contentPath: join(directory, "manifest.json"),
      host: "127.0.0.1",
      port: 3000,
    });

    try {
      const liveResponse = await application.http.inject({ method: "GET", url: "/health/live" });
      const readyResponse = await application.http.inject({ method: "GET", url: "/health/ready" });

      expect(liveResponse.statusCode).toBe(200);
      expect(readyResponse.statusCode).toBe(503);
      expect(readyResponse.json()).toEqual({
        status: "not_ready",
        checks: {
          database: "down",
          migrations: "unknown",
          content: "missing",
          content_version: "unknown",
        },
      });
    } finally {
      await application.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
