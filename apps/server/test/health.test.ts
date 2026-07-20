import { describe, expect, it } from "vitest";

import { createHttpApp } from "../src/gateway/http/create-app";

describe("health endpoints", () => {
  it("reports liveness without invoking readiness", async () => {
    let readinessCalls = 0;
    const app = createHttpApp({
      readiness: async () => {
        readinessCalls += 1;
        return { ready: false, checks: {} };
      },
    });

    const response = await app.inject({ method: "GET", url: "/health/live" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "alive" });
    expect(readinessCalls).toBe(0);
  });

  it("reports ready only when every configured gate passes", async () => {
    const app = createHttpApp({
      readiness: async () => ({
        ready: true,
        checks: { database: "up", migrations: "current" },
      }),
    });

    const response = await app.inject({ method: "GET", url: "/health/ready" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ready",
      checks: { database: "up", migrations: "current" },
    });
  });

  it("returns 503 when a readiness gate fails", async () => {
    const app = createHttpApp({
      readiness: async () => ({
        ready: false,
        checks: { database: "down", migrations: "unknown" },
      }),
    });

    const response = await app.inject({ method: "GET", url: "/health/ready" });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: "not_ready",
      checks: { database: "down", migrations: "unknown" },
    });
  });

  it("keeps probe failures behind a stable 503 response", async () => {
    const app = createHttpApp({
      readiness: async () => {
        throw new Error("probe details must not reach the response");
      },
    });

    const response = await app.inject({ method: "GET", url: "/health/ready" });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: "not_ready",
      checks: { application: "failed" },
    });
  });
});
