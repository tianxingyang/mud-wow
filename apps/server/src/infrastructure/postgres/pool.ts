import { Pool, type QueryResultRow } from "pg";

import type { DatabaseQuery } from "./migration-readiness.js";

export function createPostgresPool(databaseUrl: string): Pool {
  return new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 1_000,
    query_timeout: 1_000,
    statement_timeout: 1_000,
  });
}

export function createDatabaseQuery(pool: Pool): DatabaseQuery {
  return async <Row extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<readonly Row[]> => {
    const result = await pool.query<Row>(text, values);
    return result.rows;
  };
}
