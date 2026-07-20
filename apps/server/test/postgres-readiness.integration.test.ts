import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { createHttpApp } from "../src/gateway/http/create-app";
import { createDatabaseReadinessProbe } from "../src/infrastructure/postgres/migration-readiness";
import { createDatabaseQuery } from "../src/infrastructure/postgres/pool";

const runDatabaseIntegration = process.env.RUN_DATABASE_INTEGRATION === "1";

describe.skipIf(!runDatabaseIntegration)("PostgreSQL readiness integration", () => {
  it("reports ready against a migrated database", async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for database integration tests");
    }

    const pool = new Pool({ connectionString: databaseUrl });
    const app = createHttpApp({
      readiness: createDatabaseReadinessProbe(createDatabaseQuery(pool)),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/health/ready",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: "ready",
        checks: { database: "up", migrations: "current" },
      });
    } finally {
      await app.close();
      await pool.end();
    }
  });
});
