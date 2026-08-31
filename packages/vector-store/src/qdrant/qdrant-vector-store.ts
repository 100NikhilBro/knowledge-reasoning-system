import type { RetrievalResult } from "@knowledge/shared";
import type { EmbeddingVector } from "@knowledge/embeddings";

import type { QdrantClientPort } from "../contracts/qdrant-client-port.js";
import type { VectorStore } from "../contracts/vector-store.js";
import type { VectorStoreConfig } from "../types/vector-store-config.js";
import type { VectorRecord } from "../types/vector-record.js";
import type { VectorSearchQuery } from "../types/vector-search-query.js";

import { VectorStoreError } from "../errors/vector-store-error.js";
import { extractCollectionVectorSize }
from "../utils/collection-vector-size.js";
import { toPointId } from "../utils/to-point-id.js";

import {
  payloadMetadata,
  payloadToEntity,
  toQdrantPayload
} from "./payload.js";

const DEFAULT_TOP_K = 10;

export interface QdrantVectorStoreOptions {

  client: QdrantClientPort;

  config: VectorStoreConfig;

}

/**
 * Qdrant-backed VectorStore implementation.
 *
 * Accepts precomputed document/query embeddings so callers can reuse
 * @knowledge/embeddings without coupling storage to a specific model.
 */
export class QdrantVectorStore
  implements VectorStore {

  private readonly client: QdrantClientPort;

  private readonly config: VectorStoreConfig;

  constructor(
    options: QdrantVectorStoreOptions
  ) {

    this.client = options.client;
    this.config = options.config;

    if (
      !Number.isInteger(this.config.vectorSize) ||
      this.config.vectorSize < 2
    ) {
      throw new VectorStoreError(
        "INVALID_CONFIG",
        "vectorSize must be an integer >= 2"
      );
    }

    if (!this.config.collection.trim()) {
      throw new VectorStoreError(
        "INVALID_CONFIG",
        "collection name is required"
      );
    }

  }

  async ensureCollection(): Promise<void> {

    try {

      const existing =
        await this.client.getCollections();

      const found =
        existing.collections.some(
          collection =>
            collection.name === this.config.collection
        );

      if (found) {
        await this.assertExistingCollectionDimensions();
        return;
      }

      await this.client.createCollection(
        this.config.collection,
        {
          vectors: {
            size: this.config.vectorSize,
            distance: this.config.distance
          }
        }
      );

    } catch (error) {

      if (error instanceof VectorStoreError) {
        throw error;
      }

      throw new VectorStoreError(
        "ENSURE_COLLECTION_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to ensure Qdrant collection",
        { cause: error instanceof Error ? error : undefined }
      );

    }

  }

  /**
   * Drop the configured collection so a later ensureCollection can recreate
   * it at the current EMBEDDING_DIMENSIONS / QDRANT_VECTOR_SIZE.
   *
   * Required when switching from deterministic (e.g. 32-d) to semantic
   * embeddings — never upsert into a mismatched collection.
   */
  async deleteCollection(): Promise<void> {

    if (typeof this.client.deleteCollection !== "function") {
      throw new VectorStoreError(
        "DELETE_COLLECTION_UNSUPPORTED",
        "Qdrant client does not support deleteCollection"
      );
    }

    try {

      await this.client.deleteCollection(
        this.config.collection
      );

    } catch (error) {

      if (error instanceof VectorStoreError) {
        throw error;
      }

      throw new VectorStoreError(
        "DELETE_COLLECTION_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to delete Qdrant collection",
        { cause: error instanceof Error ? error : undefined }
      );

    }

  }

  private async assertExistingCollectionDimensions(): Promise<void> {

    if (typeof this.client.getCollection !== "function") {
      // Test fakes may omit getCollection; production Qdrant clients include it.
      return;
    }

    const info =
      await this.client.getCollection(
        this.config.collection
      );

    const existingSize =
      extractCollectionVectorSize(info);

    if (existingSize === undefined) {
      throw new VectorStoreError(
        "DIMENSION_MISMATCH",
        `Could not read vector size for Qdrant collection ` +
          `"${this.config.collection}". Recreate the collection and reindex.`
      );
    }

    if (existingSize !== this.config.vectorSize) {
      throw new VectorStoreError(
        "DIMENSION_MISMATCH",
        `Qdrant collection "${this.config.collection}" has vector size ` +
          `${existingSize}, but config expects ${this.config.vectorSize}. ` +
          `Delete/recreate the collection and reindex entities with the ` +
          `current embedding provider. Do not mix deterministic and semantic vectors.`
      );
    }

  }

  async upsert(
    records: VectorRecord[]
  ): Promise<void> {

    if (!Array.isArray(records)) {
      throw new VectorStoreError(
        "INVALID_INPUT",
        "records must be an array"
      );
    }

    if (records.length === 0) {
      return;
    }

    const points =
      records.map(record => {

        this.assertRecord(record);

        return {
          id: toPointId(record.id),
          vector: [...record.vector],
          payload: toQdrantPayload(record)
        };

      });

    try {

      await this.client.upsert(
        this.config.collection,
        {
          wait: true,
          points
        }
      );

    } catch (error) {

      if (error instanceof VectorStoreError) {
        throw error;
      }

      throw new VectorStoreError(
        "UPSERT_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to upsert vectors",
        { cause: error instanceof Error ? error : undefined }
      );

    }

  }

  async search(
    query: VectorSearchQuery
  ): Promise<RetrievalResult[]> {

    this.assertVector(
      query.vector,
      "query.vector"
    );

    const topK =
      query.topK ?? DEFAULT_TOP_K;

    if (!Number.isInteger(topK) || topK <= 0) {
      throw new VectorStoreError(
        "INVALID_INPUT",
        "topK must be a positive integer"
      );
    }

    try {

      const response =
        await this.client.query(
          this.config.collection,
          {
            query: [...query.vector],
            limit: topK,
            score_threshold: query.scoreThreshold,
            with_payload: true
          }
        );

      const points =
        response.points ?? [];

      if (points.length === 0) {
        return [];
      }

      return points.map(point => {

        const entity =
          payloadToEntity(point.payload ?? undefined);

        const metadata =
          payloadMetadata(point.payload ?? undefined);

        const result: RetrievalResult = {
          entity,
          score: point.score ?? 0,
          source: "vector"
        };

        if (metadata && Object.keys(metadata).length > 0) {
          result.metadata = metadata;
        }

        return result;

      });

    } catch (error) {

      if (error instanceof VectorStoreError) {
        throw error;
      }

      throw new VectorStoreError(
        "SEARCH_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to search vectors",
        { cause: error instanceof Error ? error : undefined }
      );

    }

  }

  private assertRecord(
    record: VectorRecord
  ): void {

    if (!record.id?.trim()) {
      throw new VectorStoreError(
        "INVALID_INPUT",
        "record.id is required"
      );
    }

    if (!record.entity?.id?.trim()) {
      throw new VectorStoreError(
        "INVALID_INPUT",
        "record.entity.id is required"
      );
    }

    this.assertVector(
      record.vector,
      `record(${record.id}).vector`
    );

  }

  private assertVector(
    vector: EmbeddingVector,
    label: string
  ): void {

    if (!Array.isArray(vector)) {
      throw new VectorStoreError(
        "INVALID_INPUT",
        `${label} must be an array`
      );
    }

    if (vector.length !== this.config.vectorSize) {
      throw new VectorStoreError(
        "DIMENSION_MISMATCH",
        `${label} length ${vector.length} does not match vectorSize ${this.config.vectorSize}`
      );
    }

    for (let index = 0; index < vector.length; index++) {

      const value = vector[index];

      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new VectorStoreError(
          "INVALID_INPUT",
          `${label}[${index}] must be a finite number`
        );
      }

    }

  }

}
