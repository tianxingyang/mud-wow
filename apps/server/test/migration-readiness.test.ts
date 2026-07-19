import type { QueryResultRow } from "pg";
import { describe, expect, it } from "vitest";

import {
  createDatabaseReadinessProbe,
  type DatabaseQuery,
  EXPECTED_DATABASE_MIGRATION,
} from "../src/infrastructure/postgres/migration-readiness";

type QueryStep = readonly QueryResultRow[] | Error;

function createQuery(steps: QueryStep[]): DatabaseQuery {
  return async <Row extends QueryResultRow>(): Promise<readonly Row[]> => {
    const step = steps.shift();

    if (step === undefined) {
      throw new Error("Unexpected query");
    }
    if (step instanceof Error) {
      throw step;
    }

    return step as readonly Row[];
  };
}

describe("database readiness", () => {
  it("is ready when PostgreSQL is reachable and the expected migration is latest", async () => {
    const probe = createDatabaseReadinessProbe(
      createQuery([[{ result: 1 }], [{ name: EXPECTED_DATABASE_MIGRATION }]]),
    );

    await expect(probe()).resolves.toEqual({
      ready: true,
      checks: { database: "up", migrations: "current" },
    });
  });

  it("is not ready when PostgreSQL is unreachable", async () => {
    const probe = createDatabaseReadinessProbe(createQuery([new Error("connection refused")]));

    await expect(probe()).resolves.toEqual({
      ready: false,
      checks: { database: "down", migrations: "unknown" },
    });
  });

  it("is not ready when migrations have not run", async () => {
    const probe = createDatabaseReadinessProbe(
      createQuery([[{ result: 1 }], new Error("relation does not exist")]),
    );

    await expect(probe()).resolves.toEqual({
      ready: false,
      checks: { database: "up", migrations: "pending" },
    });
  });

  it("is not ready when the database migration is incompatible", async () => {
    const probe = createDatabaseReadinessProbe(
      createQuery([[{ result: 1 }], [{ name: "9999_unknown" }]]),
    );

    await expect(probe()).resolves.toEqual({
      ready: false,
      checks: { database: "up", migrations: "incompatible" },
    });
  });
});
