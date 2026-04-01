import { app } from "./app";
import { config } from "./config";
import { createLogger } from "@synchive/logger";

const logger = createLogger({ service: "api-gateway" });

async function main() {
  try {
    app.listen(config.port, () => {
      logger.info(
        { port: config.port, env: config.nodeEnv },
        `API Gateway running on port ${config.port}`
      );
    });
  } catch (error) {
    logger.fatal({ error }, "Failed to start API Gateway");
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();