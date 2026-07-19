import { composeApplication } from "./composition-root.js";
import { loadServerConfig } from "./config.js";

const config = loadServerConfig();
const application = composeApplication(config);
let shutdownPromise: Promise<void> | undefined;

function shutdown(): Promise<void> {
  shutdownPromise ??= application.close();
  return shutdownPromise;
}

process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});

try {
  await application.http.listen({ host: config.host, port: config.port });
} catch (error) {
  await shutdown();
  throw error;
}
