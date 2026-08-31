import { describe, expect, it, vi } from "vitest";

import type { KnowledgeEntity, RetrievalResult } from "@knowledge/shared";

import {
  DeterministicEmbeddingProvider,
  EmbeddingService
} from "@knowledge/embeddings";

import type { VectorStore } from "../src/contracts/vector-store.js";

import { VectorStoreService }
from "../src/services/vector-store.service.js";

import { VectorStoreError }
from "../src/errors/vector-store-error.js";

function createEntity(
  id: string
): KnowledgeEntity {

  return {
    id,
    type: "Proposal",
    label: id,
    source: "pep-484.md",
    confidence: 1,
    properties: {}
  };

}

describe("VectorStoreService", () => {

  it("embeds documents via EmbeddingService then upserts", async () => {

    const upsert = vi.fn(async () => undefined);

    const store: VectorStore = {
      ensureCollection: vi.fn(async () => undefined),
      upsert,
      search: vi.fn(async () => [])
    };

    const embeddings =
      new EmbeddingService(
        new DeterministicEmbeddingProvider({
          dimensions: 8
        })
      );

    const service =
      new VectorStoreService(store, embeddings);

    const entities = [
      createEntity("proposal:PEP-484"),
      createEntity("feature:typing")
    ];

    await service.upsertEmbeddedEntities({
      entities,
      texts: [
        "Type Hints",
        "Typing feature"
      ],
      metadata: [
        { kind: "document" },
        { kind: "document" }
      ]
    });

    expect(upsert).toHaveBeenCalledOnce();

    const [records] =
      upsert.mock.calls[0];

    expect(records).toHaveLength(2);
    expect(records[0].id).toBe("proposal:PEP-484");
    expect(records[0].vector).toHaveLength(8);
    expect(records[0].metadata).toMatchObject({
      kind: "document",
      embeddingModel: "deterministic-hash-v1"
    });

  });

  it("embeds query text then searches with the resulting vector", async () => {

    const search = vi.fn(
      async (): Promise<RetrievalResult[]> => []
    );

    const store: VectorStore = {
      ensureCollection: vi.fn(async () => undefined),
      upsert: vi.fn(async () => undefined),
      search
    };

    const embeddings =
      new EmbeddingService(
        new DeterministicEmbeddingProvider({
          dimensions: 8
        })
      );

    const service =
      new VectorStoreService(store, embeddings);

    const results =
      await service.searchByText(
        "What is PEP-484?",
        { topK: 5 }
      );

    expect(results).toEqual([]);
    expect(search).toHaveBeenCalledOnce();

    const [query] =
      search.mock.calls[0];

    expect(query.topK).toBe(5);
    expect(query.vector).toHaveLength(8);

  });

  it("keeps document and query embeddings in the same vector space", async () => {

    const upsert = vi.fn(async () => undefined);
    const search = vi.fn(async () => []);

    const store: VectorStore = {
      ensureCollection: vi.fn(async () => undefined),
      upsert,
      search
    };

    const embeddings =
      new EmbeddingService(
        new DeterministicEmbeddingProvider({
          dimensions: 8,
          model: "deterministic-hash-v1"
        })
      );

    const service =
      new VectorStoreService(store, embeddings);

    const text = "Python type hints";

    await service.upsertEmbeddedEntities({
      entities: [createEntity("feature:typing")],
      texts: [text]
    });

    await service.searchByText(text, { topK: 3 });

    const documentVector =
      upsert.mock.calls[0][0][0].vector;

    const queryVector =
      search.mock.calls[0][0].vector;

    expect(documentVector).toEqual(queryVector);
    expect(documentVector).toHaveLength(8);

  });

  it("rejects mismatched entity/text lengths", async () => {

    const service =
      new VectorStoreService({
        ensureCollection: vi.fn(async () => undefined),
        upsert: vi.fn(async () => undefined),
        search: vi.fn(async () => [])
      });

    await expect(
      service.upsertEmbeddedEntities({
        entities: [createEntity("a")],
        texts: ["one", "two"]
      })
    ).rejects.toBeInstanceOf(VectorStoreError);

  });

  it("supports constructing from an EmbeddingProvider", async () => {

    const provider =
      new DeterministicEmbeddingProvider({
        dimensions: 4
      });

    const service =
      VectorStoreService.fromProvider(
        {
          ensureCollection: vi.fn(async () => undefined),
          upsert: vi.fn(async () => undefined),
          search: vi.fn(async () => [])
        },
        provider
      );

    expect(
      service.getEmbeddings().getProvider().id
    ).toBe("deterministic");

  });

});
