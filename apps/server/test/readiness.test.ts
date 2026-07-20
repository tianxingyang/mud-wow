import { describe, expect, it, vi } from "vitest";

import { combineReadinessProbes, type ReadinessProbe } from "../src/readiness";

describe("combined readiness", () => {
  it("is ready and merges checks when every probe is ready", async () => {
    const database: ReadinessProbe = async () => ({
      ready: true,
      checks: { database: "up", migrations: "current" },
    });
    const content: ReadinessProbe = async () => ({
      ready: true,
      checks: { content: "loaded", content_version: "northshire-v1-m0" },
    });

    await expect(combineReadinessProbes(database, content)()).resolves.toEqual({
      ready: true,
      checks: {
        database: "up",
        migrations: "current",
        content: "loaded",
        content_version: "northshire-v1-m0",
      },
    });
  });

  it("is not ready but still runs and merges every check when one probe fails", async () => {
    const database: ReadinessProbe = async () => ({
      ready: true,
      checks: { database: "up", migrations: "current" },
    });
    const content = vi.fn<ReadinessProbe>(async () => ({
      ready: false,
      checks: { content: "invalid", content_version: "unknown" },
    }));

    await expect(combineReadinessProbes(database, content)()).resolves.toEqual({
      ready: false,
      checks: {
        database: "up",
        migrations: "current",
        content: "invalid",
        content_version: "unknown",
      },
    });
    expect(content).toHaveBeenCalledOnce();
  });
});
