import type { ConnectionOptions } from "bullmq";

import { resolveWorkerConfig }
from "../config/resolve-worker-config.js";

import { createDocumentIngestionService }
from "./create-document-ingestion-service.js";

import { createIngestionProcessor }
from "../processors/ingestion.processor.js";

import { BullMQIngestionWorker }
from "../queue/bullmq-ingestion-worker.js";

import { BullMQIngestionQueue }
from "../queue/bullmq-ingestion-queue.js";

import { ConsoleLogger } from "../logging/logger.js";

import type { Logger } from "../logging/logger.js";

function toConnection(
  redisUrl: string
): ConnectionOptions {

  const url = new URL(redisUrl);

  return {
    host: url.hostname || "localhost",
    port: url.port ? Number(url.port) : 6379,
    ...(url.password
      ? { password: decodeURIComponent(url.password) }
      : {}),
    ...(url.username
      ? { username: decodeURIComponent(url.username) }
      : {}),
    maxRetriesPerRequest: null
  };

}

export function createIngestionRuntime(
  options: {
    env?: NodeJS.ProcessEnv;
    logger?: Logger;
  } = {}
) {

  const env =
    options.env ?? process.env;

  const logger =
    options.logger ?? new ConsoleLogger();

  const config =
    resolveWorkerConfig(env);

  const connection =
    toConnection(config.redisUrl);

  const service =
    createDocumentIngestionService({
      env,
      logger
    });

  const processor =
    createIngestionProcessor(service, logger);

  const worker =
    new BullMQIngestionWorker({
      queueName: config.queueName,
      connection,
      concurrency: config.concurrency,
      processor
    });

  const queue =
    new BullMQIngestionQueue({
      queueName: config.queueName,
      connection
    });

  return {
    config,
    service,
    worker,
    queue,
    logger
  };

}
