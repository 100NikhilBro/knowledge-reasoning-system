import type { KnowledgeEntity, RetrievalResult } from "@knowledge/shared";
import type { EmbeddingProvider } from "@knowledge/embeddings";

import {
  EmbeddingService
} from "@knowledge/embeddings";

import type { VectorStore } from "../contracts/vector-store.js";
import type { VectorRecord } from "../types/vector-record.js";
import type { VectorSearchQuery } from "../types/vector-search-query.js";

import { VectorStoreError } from "../errors/vector-store-error.js";

export interface UpsertEmbeddedEntitiesInput {

  entities: KnowledgeEntity[];

  /**
   * Text used to embed each entity. Must align 1:1 with entities.
   */
  texts: string[];

  metadata?: Array<Record<string, unknown> | undefined>;

}

/**
 * Application facade over VectorStore + EmbeddingService.
 *
 * Reuses @knowledge/embeddings for document and query vectors;
 * does not implement retrieval-package VectorRetriever.
 */
export class VectorStoreService {

  constructor(
    private readonly store: VectorStore,
    private readonly embeddings: EmbeddingService =
      new EmbeddingService()
  ) {}

  getStore(): VectorStore {
    return this.store;
  }

  getEmbeddings(): EmbeddingService {
    return this.embeddings;
  }

  async ensureCollection(): Promise<void> {
    await this.store.ensureCollection();
  }

  async upsert(
    records: VectorRecord[]
  ): Promise<void> {

    await this.store.upsert(records);

  }

  /**
   * Embed documents via the injected EmbeddingProvider, then upsert.
   */
  async upsertEmbeddedEntities(
    input: UpsertEmbeddedEntitiesInput
  ): Promise<void> {

    const { entities, texts, metadata } = input;

    if (entities.length !== texts.length) {
      throw new VectorStoreError(
        "INVALID_INPUT",
        `entities length ${entities.length} must match texts length ${texts.length}`
      );
    }

    if (
      metadata !== undefined &&
      metadata.length !== entities.length
    ) {
      throw new VectorStoreError(
        "INVALID_INPUT",
        "metadata length must match entities length when provided"
      );
    }

    if (entities.length === 0) {
      return;
    }

    const embedded =
      await this.embeddings.embedDocuments(texts);

    const records: VectorRecord[] =
      entities.map((entity, index) => ({
        id: entity.id,
        vector: embedded[index].vector,
        entity,
        metadata: {
          embeddingModel: embedded[index].model,
          ...(metadata?.[index] ?? {})
        }
      }));

    await this.store.upsert(records);

  }

  async search(
    query: VectorSearchQuery
  ): Promise<RetrievalResult[]> {

    return this.store.search(query);

  }

  /**
   * Embed a query string, then similarity-search the store.
   */
  async searchByText(
    text: string,
    options: {
      topK?: number;
      scoreThreshold?: number;
    } = {}
  ): Promise<RetrievalResult[]> {

    const embedded =
      await this.embeddings.embedQuery(text);

    return this.store.search({
      vector: embedded.vector,
      topK: options.topK,
      scoreThreshold: options.scoreThreshold
    });

  }

  static fromProvider(
    store: VectorStore,
    provider: EmbeddingProvider
  ): VectorStoreService {

    return new VectorStoreService(
      store,
      new EmbeddingService(provider)
    );

  }

}
