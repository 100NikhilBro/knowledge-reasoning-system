import path from "node:path";

import type {
  DocumentFilePort,
  DocumentParserPort,
  EntityExtractorPort,
  EntityIndexerPort,
  GraphPersistencePort,
  RelationshipExtractorPort
} from "../contracts/ingestion-ports.js";

import type {
  IngestDocumentJobPayload,
  IngestDocumentJobResult
} from "../jobs/ingest-document.job.js";

import { IngestionError } from "../errors/ingestion-error.js";

import type { Logger } from "../logging/logger.js";

import type { ProcessedDocumentStore }
from "../processed/filesystem-processed-document-store.js";

export interface DocumentIngestionServiceOptions {

  files: DocumentFilePort;

  parser: DocumentParserPort;

  entityExtractor: EntityExtractorPort;

  relationshipExtractor: RelationshipExtractorPort;

  graph: GraphPersistencePort;

  indexer: EntityIndexerPort;

  logger?: Logger;

  initializeGraphSchema?: boolean;

  /**
   * Optional post-success handler. Invoked only after all stages succeed.
   */
  processedStore?: ProcessedDocumentStore;

}

/**
 * Orchestrates:
 * raw document → parse → extract → graph persist → vector index
 * → (optional) mark processed
 *
 * Does not implement parser/extractor/graph/vector internals.
 */
export class DocumentIngestionService {

  private readonly files: DocumentFilePort;

  private readonly parser: DocumentParserPort;

  private readonly entityExtractor: EntityExtractorPort;

  private readonly relationshipExtractor: RelationshipExtractorPort;

  private readonly graph: GraphPersistencePort;

  private readonly indexer: EntityIndexerPort;

  private readonly logger?: Logger;

  private readonly initializeGraphSchema: boolean;

  private readonly processedStore?: ProcessedDocumentStore;

  constructor(
    options: DocumentIngestionServiceOptions
  ) {

    this.files = options.files;
    this.parser = options.parser;
    this.entityExtractor = options.entityExtractor;
    this.relationshipExtractor = options.relationshipExtractor;
    this.graph = options.graph;
    this.indexer = options.indexer;
    this.logger = options.logger;
    this.initializeGraphSchema =
      options.initializeGraphSchema ?? true;
    this.processedStore = options.processedStore;

  }

  async ingest(
    payload: IngestDocumentJobPayload
  ): Promise<IngestDocumentJobResult> {

    const documentPath =
      payload.documentPath?.trim();

    if (!documentPath) {
      throw new IngestionError(
        "INVALID_PAYLOAD",
        "documentPath is required"
      );
    }

    const documentId =
      payload.documentId?.trim()
      || path.basename(documentPath);

    const exists =
      await this.files.exists(documentPath);

    if (!exists) {
      throw new IngestionError(
        "DOCUMENT_NOT_FOUND",
        `Document not found: ${documentPath}`
      );
    }

    this.logger?.info("ingestion.started", {
      documentPath,
      documentId
    });

    const content =
      await this.files.read(documentPath);

    const parsed =
      this.parser.parse(content);

    if (parsed.errors?.length) {
      throw new IngestionError(
        "PARSE_FAILED",
        `Parser reported errors for ${documentId}: ${parsed.errors.join("; ")}`
      );
    }

    const entities =
      this.entityExtractor.extract(parsed.document);

    const relationships =
      this.relationshipExtractor.extract(entities);

    if (
      this.initializeGraphSchema &&
      this.graph.initialize
    ) {
      await this.graph.initialize();
    }

    await this.graph.ingest(
      entities,
      relationships
    );

    const indexed =
      await this.indexer.index(entities, {
        metadata: {
          documentId,
          documentPath,
          ...(payload.source
            ? { source: payload.source }
            : {})
        }
      });

    if (this.processedStore) {
      await this.processedStore.markProcessed({
        documentPath,
        documentId
      });
    }

    const result: IngestDocumentJobResult = {
      documentPath,
      documentId,
      entityCount: entities.length,
      relationshipCount: relationships.length,
      indexedCount: indexed.indexed,
      entityIds: indexed.entityIds
    };

    this.logger?.info("ingestion.completed", {
      documentPath,
      documentId,
      entityCount: result.entityCount,
      relationshipCount: result.relationshipCount,
      indexedCount: result.indexedCount
    });

    return result;

  }

}
