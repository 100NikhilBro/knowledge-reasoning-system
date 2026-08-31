import { describe, expect, it, vi } from "vitest";

import type { VectorStoreService } from "@knowledge/vector-store";

import { VectorStoreRetriever }
from "../src/vector/vector-store.retriever.js";

import { DummyVectorRetriever }
from "../src/vector/dummy.vector-retriever.js";

import { RetrievalError }
from "../src/errors/retrieval-error.js";

describe("VectorStoreRetriever", () => {

  it("returns semantic vector results from VectorStoreService", async () => {

    const searchByText = vi.fn(async () => [
      {
        entity: {
          id: "proposal:PEP-484",
          type: "Proposal",
          label: "Type Hints",
          source: "pep-484.md",
          confidence: 1,
          properties: { pep: "484" }
        },
        score: 0.92,
        source: "vector" as const,
        metadata: { section: "abstract" }
      }
    ]);

    const retriever =
      new VectorStoreRetriever({
        searchByText
      } as unknown as VectorStoreService);

    const results =
      await retriever.retrieve({
        query: "What are type hints?",
        topK: 5
      });

    expect(searchByText).toHaveBeenCalledWith(
      "What are type hints?",
      { topK: 5 }
    );

    expect(results).toEqual([
      {
        entity: {
          id: "proposal:PEP-484",
          type: "Proposal",
          label: "Type Hints",
          source: "pep-484.md",
          confidence: 1,
          properties: { pep: "484" }
        },
        score: 0.92,
        source: "vector",
        metadata: { section: "abstract" }
      }
    ]);

  });

  it("returns [] for empty query text", async () => {

    const searchByText = vi.fn();

    const retriever =
      new VectorStoreRetriever({
        searchByText
      } as unknown as VectorStoreService);

    await expect(
      retriever.retrieve({ query: "   " })
    ).resolves.toEqual([]);

    expect(searchByText).not.toHaveBeenCalled();

  });

  it("returns [] when the store finds no matches", async () => {

    const retriever =
      new VectorStoreRetriever({
        searchByText: vi.fn(async () => [])
      } as unknown as VectorStoreService);

    await expect(
      retriever.retrieve({ query: "unknown topic" })
    ).resolves.toEqual([]);

  });

  it("respects topK when forwarding to the store", async () => {

    const searchByText = vi.fn(async () => []);

    const retriever =
      new VectorStoreRetriever({
        searchByText
      } as unknown as VectorStoreService);

    await retriever.retrieve({
      query: "PEP 484",
      topK: 3
    });

    expect(searchByText).toHaveBeenCalledWith(
      "PEP 484",
      { topK: 3 }
    );

  });

  it("propagates store failures without fabricating evidence", async () => {

    const retriever =
      new VectorStoreRetriever({
        searchByText: vi.fn(async () => {
          throw new Error("qdrant unavailable");
        })
      } as unknown as VectorStoreService);

    await expect(
      retriever.retrieve({ query: "type hints" })
    ).rejects.toMatchObject({
      code: "VECTOR_RETRIEVAL_FAILED",
      message: "qdrant unavailable"
    });

    await expect(
      retriever.retrieve({ query: "type hints" })
    ).rejects.toBeInstanceOf(RetrievalError);

  });

  it("rejects invalid topK", async () => {

    const retriever =
      new VectorStoreRetriever({
        searchByText: vi.fn()
      } as unknown as VectorStoreService);

    await expect(
      retriever.retrieve({
        query: "type hints",
        topK: 0
      })
    ).rejects.toMatchObject({
      code: "INVALID_QUERY"
    });

  });

});

describe("DummyVectorRetriever", () => {

  it("returns an empty array", async () => {

    const retriever =
      new DummyVectorRetriever();

    await expect(
      retriever.retrieve({ query: "pep-484" })
    ).resolves.toEqual([]);

  });

});
