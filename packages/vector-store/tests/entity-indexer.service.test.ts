import { describe, expect, it, vi } from "vitest";

import type { KnowledgeEntity } from "@knowledge/shared";

import {
  EmbeddingService
} from "@knowledge/embeddings";

import type { VectorStore } from "../src/contracts/vector-store.js";
import type { VectorRecord } from "../src/types/vector-record.js";

import { DefaultEntityIndexer }
from "../src/services/entity-indexer.service.js";

import { buildEntityEmbeddingText }
from "../src/utils/build-entity-embedding-text.js";

import { createEntityIndexer }
from "../src/factories/create-entity-indexer.js";

import { VectorStoreError }
from "../src/errors/vector-store-error.js";

function createEntity(
  overrides: Partial<KnowledgeEntity> = {}
): KnowledgeEntity {

  return {
    id: "proposal:PEP-484",
    type: "Proposal",
    label: "Type Hints",
    source: "pep-484.md",
    confidence: 1,
    properties: {
      pep: "484",
      status: "Accepted"
    },
    ...overrides
  };

}

function createStore(
  overrides: Partial<VectorStore> = {}
): VectorStore & {
  ensureCollection: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
} {

  return {
    ensureCollection: vi.fn(async () => undefined),
    upsert: vi.fn(async () => undefined),
    search: vi.fn(async () => []),
    ...overrides
  };

}

describe("DefaultEntityIndexer", () => {

  it("indexes a single entity", async () => {

    const store = createStore();

    const embeddings = {
      embedDocuments: vi.fn(async () => [
        {
          vector: [0.1, 0.2, 0.3, 0.4],
          model: "test-model",
          dimensions: 4,
          metadata: { provider: "stub" }
        }
      ]),
      embedQuery: vi.fn(),
      getProvider: vi.fn()
    } as unknown as EmbeddingService;

    const indexer =
      new DefaultEntityIndexer({
        store,
        embeddings
      });

    const entity = createEntity();

    const result =
      await indexer.index(entity);

    expect(result).toEqual({
      indexed: 1,
      entityIds: ["proposal:PEP-484"]
    });

    expect(store.ensureCollection)
      .toHaveBeenCalledOnce();

    expect(embeddings.embedDocuments)
      .toHaveBeenCalledWith([
        buildEntityEmbeddingText(entity)
      ]);

    expect(store.upsert).toHaveBeenCalledOnce();

    const [records] =
      store.upsert.mock.calls[0] as [VectorRecord[]];

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(entity.id);
    expect(records[0].entity).toEqual(entity);
    expect(records[0].vector).toEqual([0.1, 0.2, 0.3, 0.4]);

  });

  it("indexes multiple entities in batches", async () => {

    const store = createStore();

    const embeddings = {
      embedDocuments: vi.fn(async (texts: string[]) =>
        texts.map((_, index) => ({
          vector: [index, 0, 0, 1],
          model: "test-model",
          dimensions: 4
        }))
      ),
      embedQuery: vi.fn(),
      getProvider: vi.fn()
    } as unknown as EmbeddingService;

    const indexer =
      new DefaultEntityIndexer({
        store,
        embeddings,
        config: {
          batchSize: 2,
          ensureCollection: true
        }
      });

    const entities = [
      createEntity({ id: "proposal:PEP-484", label: "Type Hints" }),
      createEntity({
        id: "feature:typing",
        type: "Feature",
        label: "Typing"
      }),
      createEntity({
        id: "author:guido",
        type: "Author",
        label: "Guido van Rossum"
      })
    ];

    const result =
      await indexer.index(entities);

    expect(result.indexed).toBe(3);
    expect(result.entityIds).toEqual([
      "proposal:PEP-484",
      "feature:typing",
      "author:guido"
    ]);

    expect(embeddings.embedDocuments)
      .toHaveBeenCalledTimes(2);

    expect(store.upsert)
      .toHaveBeenCalledTimes(2);

    const firstBatch =
      store.upsert.mock.calls[0][0] as VectorRecord[];

    const secondBatch =
      store.upsert.mock.calls[1][0] as VectorRecord[];

    expect(firstBatch).toHaveLength(2);
    expect(secondBatch).toHaveLength(1);

  });

  it("handles an empty entity list without provider or store calls", async () => {

    const store = createStore();

    const embeddings = {
      embedDocuments: vi.fn(),
      embedQuery: vi.fn(),
      getProvider: vi.fn()
    } as unknown as EmbeddingService;

    const indexer =
      new DefaultEntityIndexer({
        store,
        embeddings
      });

    const result =
      await indexer.index([]);

    expect(result).toEqual({
      indexed: 0,
      entityIds: []
    });

    expect(store.ensureCollection)
      .not.toHaveBeenCalled();

    expect(embeddings.embedDocuments)
      .not.toHaveBeenCalled();

    expect(store.upsert)
      .not.toHaveBeenCalled();

  });

  it("supports dependency injection of store and embeddings", async () => {

    const store = createStore();

    const embeddings = {
      embedDocuments: vi.fn(async () => [
        {
          vector: [1, 0, 0, 0],
          model: "injected",
          dimensions: 4
        }
      ]),
      embedQuery: vi.fn(),
      getProvider: vi.fn()
    } as unknown as EmbeddingService;

    const indexer =
      createEntityIndexer(store, embeddings, {
        batchSize: 10,
        ensureCollection: false
      });

    await indexer.index(createEntity());

    expect(store.ensureCollection)
      .not.toHaveBeenCalled();

    expect(embeddings.embedDocuments)
      .toHaveBeenCalledOnce();

    expect(store.upsert)
      .toHaveBeenCalledOnce();

  });

  it("propagates entity metadata into vector records", async () => {

    const store = createStore();

    const embeddings = {
      embedDocuments: vi.fn(async () => [
        {
          vector: [0.5, 0.5, 0.5, 0.5],
          model: "meta-model",
          dimensions: 4
        }
      ]),
      embedQuery: vi.fn(),
      getProvider: vi.fn()
    } as unknown as EmbeddingService;

    const indexer =
      new DefaultEntityIndexer({
        store,
        embeddings
      });

    const entity = createEntity({
      properties: {
        pep: "484",
        title: "Type Hints"
      }
    });

    await indexer.index(entity, {
      metadata: {
        pipeline: "unit-test",
        documentId: "pep-484.md"
      }
    });

    const [records] =
      store.upsert.mock.calls[0] as [VectorRecord[]];

    expect(records[0].entity).toEqual({
      id: entity.id,
      type: entity.type,
      label: entity.label,
      source: entity.source,
      confidence: entity.confidence,
      properties: {
        pep: "484",
        title: "Type Hints"
      }
    });

    expect(records[0].metadata).toEqual({
      embeddingModel: "meta-model",
      embeddingDimensions: 4,
      indexedAs: "knowledge-entity",
      pipeline: "unit-test",
      documentId: "pep-484.md"
    });

  });

  it("propagates embedding failures", async () => {

    const store = createStore();

    const embeddings = {
      embedDocuments: vi.fn(async () => {
        throw new Error("embedding unavailable");
      }),
      embedQuery: vi.fn(),
      getProvider: vi.fn()
    } as unknown as EmbeddingService;

    const indexer =
      new DefaultEntityIndexer({
        store,
        embeddings
      });

    await expect(
      indexer.index(createEntity())
    ).rejects.toThrow("embedding unavailable");

    expect(store.upsert)
      .not.toHaveBeenCalled();

  });

  it("propagates vector store failures", async () => {

    const store = createStore({
      upsert: vi.fn(async () => {
        throw new VectorStoreError(
          "UPSERT_FAILED",
          "qdrant down"
        );
      })
    });

    const embeddings = {
      embedDocuments: vi.fn(async () => [
        {
          vector: [0, 1, 0, 0],
          model: "test-model",
          dimensions: 4
        }
      ]),
      embedQuery: vi.fn(),
      getProvider: vi.fn()
    } as unknown as EmbeddingService;

    const indexer =
      new DefaultEntityIndexer({
        store,
        embeddings
      });

    await expect(
      indexer.index(createEntity())
    ).rejects.toMatchObject({
      code: "UPSERT_FAILED",
      message: "qdrant down"
    });

  });

  it("is idempotent for the same entity id across re-index calls", async () => {

    const store = createStore();

    const embeddings = {
      embedDocuments: vi.fn(async () => [
        {
          vector: [0.2, 0.2, 0.2, 0.2],
          model: "test-model",
          dimensions: 4
        }
      ]),
      embedQuery: vi.fn(),
      getProvider: vi.fn()
    } as unknown as EmbeddingService;

    const indexer =
      new DefaultEntityIndexer({
        store,
        embeddings
      });

    const entity = createEntity();

    await indexer.index(entity);
    await indexer.index(entity);

    const firstId =
      (store.upsert.mock.calls[0][0] as VectorRecord[])[0].id;

    const secondId =
      (store.upsert.mock.calls[1][0] as VectorRecord[])[0].id;

    expect(firstId).toBe(entity.id);
    expect(secondId).toBe(entity.id);

  });

});

describe("buildEntityEmbeddingText", () => {

  it("includes type, label, source, and scalar properties", () => {

    const text =
      buildEntityEmbeddingText(
        createEntity()
      );

    expect(text).toContain("Proposal");
    expect(text).toContain("Type Hints");
    expect(text).toContain("pep-484.md");
    expect(text).toContain("pep: 484");
    expect(text).toContain("status: Accepted");

  });

});
