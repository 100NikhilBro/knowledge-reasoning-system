import { resolveKnowledgePathsConfig }
from "../config/resolve-knowledge-paths.js";

import { resolveWorkerConfig }
from "../config/resolve-worker-config.js";

import { RawDocumentDiscovery }
from "../discovery/raw-document-discovery.js";

import { DocumentIngestionProducer }
from "../services/document-ingestion-producer.js";

import { BullMQIngestionQueue }
from "../queue/bullmq-ingestion-queue.js";

import { ConsoleLogger } from "../logging/logger.js";

import type { Logger } from "../logging/logger.js";

import type { ConnectionOptions } from "bullmq";

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

/**
 * Wire a multi-document discovery → enqueue producer from env.
 */
export function createDocumentIngestionProducer(
  options: {
    env?: NodeJS.ProcessEnv;
    logger?: Logger;
    queue?: BullMQIngestionQueue;
  } = {}
) {

  const env =
    options.env ?? process.env;

  const logger =
    options.logger ?? new ConsoleLogger();

  const workerConfig =
    resolveWorkerConfig(env);

  const paths =
    resolveKnowledgePathsConfig(env);

  const discovery =
    new RawDocumentDiscovery({
      rawDir: paths.rawDir,
      processedDir: paths.processedDir,
      supportedExtensions: paths.supportedExtensions,
      logger
    });

  const queue =
    options.queue
    ?? new BullMQIngestionQueue({
      queueName: workerConfig.queueName,
      connection: toConnection(workerConfig.redisUrl)
    });

  const producer =
    new DocumentIngestionProducer(
      discovery,
      queue,
      logger
    );

  return {
    producer,
    discovery,
    queue,
    paths,
    logger
  };

}
