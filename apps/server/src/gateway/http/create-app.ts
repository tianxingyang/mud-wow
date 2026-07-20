import Fastify, { type FastifyInstance } from "fastify";

import type { ReadinessProbe } from "../../readiness.js";

export interface CreateHttpAppOptions {
  readonly readiness: ReadinessProbe;
  readonly logger?: boolean;
}

export function createHttpApp({
  readiness,
  logger = false,
}: CreateHttpAppOptions): FastifyInstance {
  const app = Fastify({ logger });

  app.get("/health/live", async (_request, reply) => {
    return reply.code(200).send({ status: "alive" });
  });

  app.get("/health/ready", async (request, reply) => {
    try {
      const result = await readiness();

      return reply.code(result.ready ? 200 : 503).send({
        status: result.ready ? "ready" : "not_ready",
        checks: result.checks,
      });
    } catch (error) {
      request.log.error({ err: error }, "Readiness probe failed");

      return reply.code(503).send({
        status: "not_ready",
        checks: { application: "failed" },
      });
    }
  });

  return app;
}
