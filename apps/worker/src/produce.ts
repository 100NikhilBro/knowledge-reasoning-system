import "./config/load-env.js";

import { createDocumentIngestionProducer }
from "./factories/create-document-ingestion-producer.js";

/**
 * Thin producer entrypoint: discover raw docs and enqueue ingest jobs.
 */
async function main(): Promise<void> {

  const { producer, queue, logger, paths } =
    createDocumentIngestionProducer();

  logger.info("producer.started", {
    rawDir: paths.rawDir,
    processedDir: paths.processedDir
  });

  try {

    const result =
      await producer.enqueueDiscovered();

    logger.info("producer.finished", {
      discovered: result.discovered,
      enqueued: result.enqueued,
      skippedDuplicate: result.skippedDuplicate,
      failed: result.failed
    });

  } finally {

    await queue.close();

  }

}

main().catch(error => {

  console.error(
    JSON.stringify({
      level: "error",
      message: "producer.boot_failed",
      error:
        error instanceof Error
          ? error.message
          : String(error),
      timestamp: new Date().toISOString()
    })
  );

  process.exit(1);

});
