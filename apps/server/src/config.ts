import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ServerConfig {
  readonly databaseUrl: string;
  readonly contentPath: string;
  readonly host: string;
  readonly port: number;
}

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));

function parsePort(value: string): number {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535; received ${value}`);
  }

  return port;
}

export function loadServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const databaseUrl = environment.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return {
    databaseUrl,
    contentPath: resolve(
      repositoryRoot,
      environment.CONTENT_PATH ?? "content/northshire-v1/manifest.json",
    ),
    host: environment.HOST ?? "127.0.0.1",
    port: parsePort(environment.PORT ?? "3000"),
  };
}
