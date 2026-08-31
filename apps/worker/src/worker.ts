import "./config/load-env.js";

import { createIngestionRuntime }
from "./factories/create-ingestion-runtime.js";

/**
 * Thin BullMQ worker entrypoint.
 * Orchestration lives in DocumentIngestionService.
 */
async function main(): Promise<void> {

  const { worker, config, logger } =
    createIngestionRuntime();

  logger.info("worker.started", {
    queueName: config.queueName,
    concurrency: config.concurrency
  });

  const shutdown = async (
    signal: string
  ): Promise<void> => {

    logger.info("worker.shutting_down", { signal });
    await worker.close();
    process.exit(0);

  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

}

main().catch(error => {

  console.error(
    JSON.stringify({
      level: "error",
      message: "worker.boot_failed",
      error:
        error instanceof Error
          ? error.message
          : String(error),
      timestamp: new Date().toISOString()
    })
  );

  process.exit(1);

});
