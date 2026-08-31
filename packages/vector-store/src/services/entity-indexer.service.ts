import type { KnowledgeEntity } from "@knowledge/shared";

import {
  EmbeddingService
} from "@knowledge/embeddings";

import type { EntityIndexer } from "../contracts/entity-indexer.js";
import type { VectorStore } from "../contracts/vector-store.js";
import type { IndexingConfig } from "../types/indexing-config.js";
import type { IndexingOptions } from "../types/indexing-options.js";
import type { IndexingResult } from "../types/indexing-result.js";
import type { VectorRecord } from "../types/vector-record.js";

import { VectorStoreError } from "../errors/vector-store-error.js";

import { buildEntityEmbeddingText }
from "../utils/build-entity-embedding-text.js";

export interface DefaultEntityIndexerOptions {

  store: VectorStore;

  embeddings?: EmbeddingService;

  config?: IndexingConfig;

  /**
   * Optional override for entity → embedding text.
   */
  buildText?: (entity: KnowledgeEntity) => string;

}

/**
 * Production indexing service: KnowledgeEntity → embeddings → VectorStore upsert.
 *
 * Idempotent for the same entity id (stable VectorStore point id).
 * Independent of Neo4j; delegates embedding and persistence to injected deps.
 */
export class DefaultEntityIndexer
  implements EntityIndexer {

  private readonly store: VectorStore;

  private readonly embeddings: EmbeddingService;

  private readonly config: IndexingConfig;

  private readonly buildText: (entity: KnowledgeEntity) => string;

  constructor(
    options: DefaultEntityIndexerOptions
  ) {

    this.store = options.store;

    this.embeddings =
      options.embeddings ?? new EmbeddingService();

    this.config =
      options.config ?? {
        batchSize: 64,
        ensureCollection: true
      };

    this.buildText =
      options.buildText ?? buildEntityEmbeddingText;

  }

  async index(
    entities: KnowledgeEntity | KnowledgeEntity[],
    options: IndexingOptions = {}
  ): Promise<IndexingResult> {

    const list =
      Array.isArray(entities)
        ? entities
        : [entities];

    this.assertEntities(list);

    if (list.length === 0) {
      return {
        indexed: 0,
        entityIds: []
      };
    }

    const batchSize =
      options.batchSize ?? this.config.batchSize;

    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new VectorStoreError(
        "INVALID_INPUT",
        "batchSize must be a positive integer"
      );
    }

    const ensureCollection =
      options.ensureCollection ?? this.config.ensureCollection;

    if (ensureCollection) {
      await this.store.ensureCollection();
    }

    const entityIds: string[] = [];

    for (let offset = 0; offset < list.length; offset += batchSize) {

      const batch =
        list.slice(offset, offset + batchSize);

      const texts =
        batch.map(entity => this.buildText(entity));

      const embedded =
        await this.embeddings.embedDocuments(texts);

      if (embedded.length !== batch.length) {
        throw new VectorStoreError(
          "EMBEDDING_COUNT_MISMATCH",
          `Expected ${batch.length} embeddings, received ${embedded.length}`
        );
      }

      const records: VectorRecord[] =
        batch.map((entity, index) => ({
          id: entity.id,
          vector: embedded[index].vector,
          entity: {
            id: entity.id,
            type: entity.type,
            label: entity.label,
            source: entity.source,
            confidence: entity.confidence,
            properties: entity.properties ?? {}
          },
          metadata: {
            embeddingModel: embedded[index].model,
            embeddingDimensions: embedded[index].dimensions,
            indexedAs: "knowledge-entity",
            ...(options.metadata ?? {})
          }
        }));

      await this.store.upsert(records);

      for (const entity of batch) {
        entityIds.push(entity.id);
      }

    }

    return {
      indexed: entityIds.length,
      entityIds
    };

  }

  private assertEntities(
    entities: KnowledgeEntity[]
  ): void {

    for (let index = 0; index < entities.length; index++) {

      const entity = entities[index];

      if (!entity || typeof entity !== "object") {
        throw new VectorStoreError(
          "INVALID_INPUT",
          `entities[${index}] must be a KnowledgeEntity`
        );
      }

      if (!entity.id?.trim()) {
        throw new VectorStoreError(
          "INVALID_INPUT",
          `entities[${index}].id is required`
        );
      }

      if (!entity.type?.trim()) {
        throw new VectorStoreError(
          "INVALID_INPUT",
          `entities[${index}].type is required`
        );
      }

      if (!entity.label?.trim()) {
        throw new VectorStoreError(
          "INVALID_INPUT",
          `entities[${index}].label is required`
        );
      }

      if (typeof entity.source !== "string") {
        throw new VectorStoreError(
          "INVALID_INPUT",
          `entities[${index}].source is required`
        );
      }

    }

  }

}
