import type { FastifyInstance } from "fastify";

import type { ServerConfig } from "./config.js";
import { createHttpApp } from "./gateway/http/create-app.js";
import { createContentReadinessProbe } from "./infrastructure/content/content-readiness.js";
import { loadContent } from "./infrastructure/content/load-content.js";
import { createDatabaseReadinessProbe } from "./infrastructure/postgres/migration-readiness.js";
import { createDatabaseQuery, createPostgresPool } from "./infrastructure/postgres/pool.js";
import { combineReadinessProbes } from "./readiness.js";

export interface ApplicationComposition {
  readonly http: FastifyInstance;
  close(): Promise<void>;
}

export function composeApplication(config: ServerConfig): ApplicationComposition {
  const content = loadContent(config.contentPath);
  const pool = createPostgresPool(config.databaseUrl);
  const readiness = combineReadinessProbes(
    createDatabaseReadinessProbe(createDatabaseQuery(pool)),
    createContentReadinessProbe(content),
  );
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
