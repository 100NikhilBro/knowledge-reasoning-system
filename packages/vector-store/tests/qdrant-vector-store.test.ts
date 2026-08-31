import { describe, expect, it, vi } from "vitest";

import type { KnowledgeEntity } from "@knowledge/shared";

import type { QdrantClientPort } from "../src/contracts/qdrant-client-port.js";

import { QdrantVectorStore }
from "../src/qdrant/qdrant-vector-store.js";

import { VectorStoreError }
from "../src/errors/vector-store-error.js";

import { toPointId }
from "../src/utils/to-point-id.js";

function createEntity(
  overrides: Partial<KnowledgeEntity> = {}
): KnowledgeEntity {

  return {
    id: "proposal:PEP-484",
    type: "Proposal",
    label: "Type Hints",
    source: "pep-484.md",
    confidence: 1,
    properties: { pep: "484" },
    ...overrides
  };

}

function createClient(
  overrides: Partial<QdrantClientPort> = {}
): QdrantClientPort {

  return {
    getCollections: vi.fn(async () => ({
      collections: []
    })),
    createCollection: vi.fn(async () => true),
    upsert: vi.fn(async () => true),
    query: vi.fn(async () => ({
      points: []
    })),
    ...overrides
  };

}

const config = {
  url: "http://localhost:6333",
  collection: "knowledge_entities",
  vectorSize: 4,
  distance: "Cosine" as const
};

describe("QdrantVectorStore", () => {

  it("creates the collection when it does not exist", async () => {

    const client = createClient();

    const store =
      new QdrantVectorStore({ client, config });

    await store.ensureCollection();

    expect(client.getCollections)
      .toHaveBeenCalledOnce();

    expect(client.createCollection)
      .toHaveBeenCalledWith(
        "knowledge_entities",
        {
          vectors: {
            size: 4,
            distance: "Cosine"
          }
        }
      );

  });

  it("skips create when the collection already exists with matching size", async () => {

    const client = createClient({
      getCollections: vi.fn(async () => ({
        collections: [
          { name: "knowledge_entities" }
        ]
      })),
      getCollection: vi.fn(async () => ({
        result: {
          config: {
            params: {
              vectors: {
                size: 4,
                distance: "Cosine"
              }
            }
          }
        }
      }))
    });

    const store =
      new QdrantVectorStore({ client, config });

    await store.ensureCollection();

    expect(client.createCollection)
      .not.toHaveBeenCalled();

    expect(client.getCollection)
      .toHaveBeenCalledWith("knowledge_entities");

  });

  it("rejects an existing collection with the wrong vector size", async () => {

    const client = createClient({
      getCollections: vi.fn(async () => ({
        collections: [
          { name: "knowledge_entities" }
        ]
      })),
      getCollection: vi.fn(async () => ({
        result: {
          config: {
            params: {
              vectors: {
                size: 32,
                distance: "Cosine"
              }
            }
          }
        }
      }))
    });

    const store =
      new QdrantVectorStore({ client, config });

    await expect(
      store.ensureCollection()
    ).rejects.toMatchObject({
      code: "DIMENSION_MISMATCH"
    });

  });

  it("deletes a collection for semantic reindex migration", async () => {

    const client = createClient({
      deleteCollection: vi.fn(async () => true)
    });

    const store =
      new QdrantVectorStore({ client, config });

    await store.deleteCollection();

    expect(client.deleteCollection)
      .toHaveBeenCalledWith("knowledge_entities");

  });

  it("upserts entity embeddings with required payload fields", async () => {

    const client = createClient();

    const store =
      new QdrantVectorStore({ client, config });

    const entity = createEntity();

    await store.upsert([
      {
        id: entity.id,
        vector: [0.1, 0.2, 0.3, 0.4],
        entity,
        metadata: { section: "abstract" }
      }
    ]);

    expect(client.upsert).toHaveBeenCalledWith(
      "knowledge_entities",
      {
        wait: true,
        points: [
          {
            id: toPointId(entity.id),
            vector: [0.1, 0.2, 0.3, 0.4],
            payload: {
              entityId: entity.id,
              type: "Proposal",
              label: "Type Hints",
              source: "pep-484.md",
              confidence: 1,
              properties: { pep: "484" },
              metadata: { section: "abstract" }
            }
          }
        ]
      }
    );

  });

  it("no-ops on empty upsert batches", async () => {

    const client = createClient();

    const store =
      new QdrantVectorStore({ client, config });

    await store.upsert([]);

    expect(client.upsert).not.toHaveBeenCalled();

  });

  it("returns an empty array when similarity search finds nothing", async () => {

    const client = createClient();

    const store =
      new QdrantVectorStore({ client, config });

    const results =
      await store.search({
        vector: [0.1, 0.2, 0.3, 0.4],
        topK: 5
      });

    expect(results).toEqual([]);

  });

  it("maps search hits to RetrievalResult with source vector", async () => {

    const entity = createEntity();

    const client = createClient({
      query: vi.fn(async () => ({
        points: [
          {
            id: toPointId(entity.id),
            score: 0.91,
            payload: {
              entityId: entity.id,
              type: entity.type,
              label: entity.label,
              source: entity.source,
              confidence: entity.confidence,
              properties: entity.properties,
              metadata: { section: "motivation" }
            }
          }
        ]
      }))
    });

    const store =
      new QdrantVectorStore({ client, config });

    const results =
      await store.search({
        vector: [0.1, 0.2, 0.3, 0.4],
        topK: 3
      });

    expect(results).toEqual([
      {
        entity,
        score: 0.91,
        source: "vector",
        metadata: { section: "motivation" }
      }
    ]);

  });

  it("rejects vectors with the wrong dimensions", async () => {

    const store =
      new QdrantVectorStore({
        client: createClient(),
        config
      });

    await expect(
      store.search({
        vector: [1, 2],
        topK: 1
      })
    ).rejects.toMatchObject({
      code: "DIMENSION_MISMATCH"
    });

  });

  it("wraps client failures as VectorStoreError", async () => {

    const client = createClient({
      getCollections: vi.fn(async () => {
        throw new Error("connection refused");
      })
    });

    const store =
      new QdrantVectorStore({ client, config });

    await expect(
      store.ensureCollection()
    ).rejects.toBeInstanceOf(VectorStoreError);

  });

});
