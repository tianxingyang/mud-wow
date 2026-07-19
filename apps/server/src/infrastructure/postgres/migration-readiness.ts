import type { QueryResultRow } from "pg";

import type { ReadinessProbe } from "../../readiness.js";

export const EXPECTED_DATABASE_MIGRATION = "0001_database_baseline";

export type DatabaseQuery = <Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
) => Promise<readonly Row[]>;

interface MigrationRow extends QueryResultRow {
  readonly name: string;
}

export function createDatabaseReadinessProbe(query: DatabaseQuery): ReadinessProbe {
  return async () => {
    try {
      await query("SELECT 1");
    } catch {
      return {
        ready: false,
        checks: { database: "down", migrations: "unknown" },
      };
    }

    try {
      const [latestMigration] = await query<MigrationRow>(
        "SELECT name FROM public.mud_wow_migrations ORDER BY id DESC LIMIT 1",
      );
      const migrationStatus =
        latestMigration === undefined
          ? "pending"
          : latestMigration.name === EXPECTED_DATABASE_MIGRATION
            ? "current"
            : "incompatible";

      return {
        ready: migrationStatus === "current",
        checks: { database: "up", migrations: migrationStatus },
      };
    } catch {
      return {
        ready: false,
        checks: { database: "up", migrations: "pending" },
      };
    }
  };
}
