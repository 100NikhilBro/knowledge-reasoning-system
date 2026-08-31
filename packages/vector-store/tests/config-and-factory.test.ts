import { describe, expect, it } from "vitest";

import { resolveVectorStoreConfig }
from "../src/config/resolve-vector-store-config.js";

import { resolveIndexingConfig }
from "../src/config/resolve-indexing-config.js";

import {
  createQdrantVectorStore,
  createQdrantVectorStoreFromEnv
} from "../src/factories/create-vector-store.js";

import {
  createEntityIndexer
} from "../src/factories/create-entity-indexer.js";

import { DefaultEntityIndexer }
from "../src/services/entity-indexer.service.js";

import { QdrantVectorStore }
from "../src/qdrant/qdrant-vector-store.js";

import { toPointId }
from "../src/utils/to-point-id.js";

import { VectorStoreError }
from "../src/errors/vector-store-error.js";

describe("resolveVectorStoreConfig", () => {

  it("uses docker-compatible defaults", () => {

    const config =
      resolveVectorStoreConfig({});

    expect(config).toMatchObject({
      url: "http://localhost:6333",
      collection: "knowledge_entities",
      vectorSize: 32,
      distance: "Cosine",
      timeoutMs: 30_000
    });

    expect(config.apiKey).toBeUndefined();

  });

  it("falls back to EMBEDDING_DIMENSIONS for vector size", () => {

    const config =
      resolveVectorStoreConfig({
        EMBEDDING_DIMENSIONS: "64"
      });

    expect(config.vectorSize).toBe(64);

  });

  it("reads optional api key from env only", () => {

    const config =
      resolveVectorStoreConfig({
        QDRANT_URL: "http://qdrant:6333",
        QDRANT_COLLECTION: "entities",
        QDRANT_VECTOR_SIZE: "16",
        QDRANT_DISTANCE: "Dot",
        QDRANT_API_KEY: "secret-from-env",
        QDRANT_TIMEOUT_MS: "12000"
      });

    expect(config).toEqual({
      url: "http://qdrant:6333",
      collection: "entities",
      vectorSize: 16,
      distance: "Dot",
      apiKey: "secret-from-env",
      timeoutMs: 12_000
    });

  });

  it("rejects invalid distance values", () => {

    expect(() =>
      resolveVectorStoreConfig({
        QDRANT_DISTANCE: "Manhattan"
      })
    ).toThrow(VectorStoreError);

  });

});

describe("createQdrantVectorStore", () => {

  it("builds a QdrantVectorStore with an injected client", () => {

    const store =
      createQdrantVectorStore(
        {
          url: "http://localhost:6333",
          collection: "knowledge_entities",
          vectorSize: 8,
          distance: "Cosine"
        },
        {
          getCollections: async () => ({ collections: [] }),
          createCollection: async () => true,
          upsert: async () => true,
          query: async () => ({ points: [] })
        }
      );

    expect(store).toBeInstanceOf(QdrantVectorStore);

  });

  it("creates a store from environment config", () => {

    const store =
      createQdrantVectorStoreFromEnv(
        {
          EMBEDDING_DIMENSIONS: "8",
          QDRANT_COLLECTION: "from-env",
          QDRANT_VECTOR_SIZE: "8"
        },
        {
          getCollections: async () => ({ collections: [] }),
          createCollection: async () => true,
          upsert: async () => true,
          query: async () => ({ points: [] })
        }
      );

    expect(store).toBeInstanceOf(QdrantVectorStore);

  });

  it("rejects env wiring when embedding and qdrant dims diverge", () => {

    expect(() =>
      createQdrantVectorStoreFromEnv({
        EMBEDDING_PROVIDER: "deterministic",
        EMBEDDING_DIMENSIONS: "32",
        QDRANT_VECTOR_SIZE: "1536"
      })
    ).toThrow(VectorStoreError);

  });

});

describe("resolveIndexingConfig", () => {

  it("defaults batch size and ensureCollection", () => {

    expect(resolveIndexingConfig({})).toEqual({
      batchSize: 64,
      ensureCollection: true
    });

  });

  it("reads indexing env and falls back to embedding batch size", () => {

    expect(
      resolveIndexingConfig({
        EMBEDDING_MAX_BATCH_SIZE: "32"
      })
    ).toMatchObject({
      batchSize: 32
    });

    expect(
      resolveIndexingConfig({
        INDEXING_BATCH_SIZE: "16",
        INDEXING_ENSURE_COLLECTION: "false"
      })
    ).toEqual({
      batchSize: 16,
      ensureCollection: false
    });

  });

});

describe("createEntityIndexer", () => {

  it("returns a DefaultEntityIndexer", () => {

    const indexer =
      createEntityIndexer({
        ensureCollection: async () => undefined,
        upsert: async () => undefined,
        search: async () => []
      });

    expect(indexer).toBeInstanceOf(DefaultEntityIndexer);

  });

});

describe("toPointId", () => {

  it("returns a stable UUID for the same entity id", () => {

    const first =
      toPointId("proposal:PEP-484");

    const second =
      toPointId("proposal:PEP-484");

    expect(first).toBe(second);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );

  });

  it("returns different ids for different entities", () => {

    expect(
      toPointId("proposal:PEP-484")
    ).not.toBe(
      toPointId("feature:typing")
    );

  });

});
