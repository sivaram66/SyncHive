import { createLogger } from "@synchive/logger";
import { closeRedisConnection } from "@synchive/queue";
import { startWorkers, stopWorkers } from "./workers";
import { config } from "./config";

const logger = createLogger({ service: "workflow-engine" });

async function main() {
  try {
    logger.info(
      {
        env: config.nodeEnv,
        executionConcurrency: config.maxConcurrency,
        stepConcurrency: config.stepConcurrency,
      },
      "Starting workflow engine"
    );

    await startWorkers();

    logger.info("Workflow engine is running and listening for jobs");
  } catch (error) {
    logger.fatal({ error }, "Failed to start workflow engine");
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received, draining workers...");

    try {
      await stopWorkers();
      await closeRedisConnection();
      logger.info("Shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error({ error }, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();