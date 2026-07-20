export interface ServerConfig {
  readonly databaseUrl: string;
  readonly host: string;
  readonly port: number;
}

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
    host: environment.HOST ?? "127.0.0.1",
    port: parsePort(environment.PORT ?? "3000"),
  };
}
