import { PEPParser } from "@knowledge/parser";

import {
  EntityExtractor,
  RelationshipExtractor
} from "@knowledge/extractor";

import { GraphService } from "@knowledge/graph";

import { createEntityIndexerFromEnv } from "@knowledge/vector-store";

import type { DocumentIngestionServiceOptions }
from "../services/document-ingestion.service.js";

import { DocumentIngestionService }
from "../services/document-ingestion.service.js";

import { FilesystemDocumentFile }
from "../io/filesystem-document-file.js";

import { ConsoleLogger } from "../logging/logger.js";

import type { Logger } from "../logging/logger.js";

import { resolveWorkerConfig }
from "../config/resolve-worker-config.js";

import { resolveKnowledgePathsConfig }
from "../config/resolve-knowledge-paths.js";

import { FilesystemProcessedDocumentStore }
from "../processed/filesystem-processed-document-store.js";

/**
 * Wire production ingestion dependencies from existing packages + env.
 *
 * PARSER LIMITATION: uses PEPParser — documents must be PEP-style markdown.
 */
export function createDocumentIngestionService(
  options: {
    env?: NodeJS.ProcessEnv;
    logger?: Logger;
    initializeGraphSchema?: boolean;
    markProcessed?: boolean;
  } = {}
): DocumentIngestionService {

  const env =
    options.env ?? process.env;

  const config =
    resolveWorkerConfig(env);

  const paths =
    resolveKnowledgePathsConfig(env);

  const logger =
    options.logger ?? new ConsoleLogger();

  const markProcessed =
    options.markProcessed ?? true;

  const deps: DocumentIngestionServiceOptions = {
    files: new FilesystemDocumentFile(),
    parser: new PEPParser(),
    entityExtractor: new EntityExtractor(),
    relationshipExtractor: new RelationshipExtractor(),
    graph: new GraphService(),
    indexer: createEntityIndexerFromEnv(env),
    logger,
    initializeGraphSchema:
      options.initializeGraphSchema
      ?? config.initializeGraphSchema,
    ...(markProcessed
      ? {
        processedStore:
          new FilesystemProcessedDocumentStore({
            rawDir: paths.rawDir,
            processedDir: paths.processedDir,
            logger
          })
      }
      : {})
  };

  return new DocumentIngestionService(deps);

}
