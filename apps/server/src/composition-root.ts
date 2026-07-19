import type { FastifyInstance } from "fastify";

import type { ServerConfig } from "./config.js";
import { createHttpApp } from "./gateway/http/create-app.js";
import { createDatabaseReadinessProbe } from "./infrastructure/postgres/migration-readiness.js";
import { createDatabaseQuery, createPostgresPool } from "./infrastructure/postgres/pool.js";

export interface ApplicationComposition {
  readonly http: FastifyInstance;
  close(): Promise<void>;
}

export function composeApplication(config: ServerConfig): ApplicationComposition {
  const pool = createPostgresPool(config.databaseUrl);
  const readiness = createDatabaseReadinessProbe(createDatabaseQuery(pool));
  const http = createHttpApp({ readiness, logger: true });

  pool.on("error", (error) => {
    http.log.error({ err: error }, "Unexpected idle PostgreSQL client error");
  });

  return {
    http,
    async close() {
      await http.close();
      await pool.end();
    },
  };
}
