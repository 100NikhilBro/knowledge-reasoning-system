import { describe, expect, it } from "vitest";

import { DummyVectorRetriever } from "../src/vector/dummy.vector-retriever.js";
import { VectorStoreRetriever } from "../src/vector/vector-store.retriever.js";
import { RetrievalService } from "../src/services/retrieval.service.js";
import { createRetrievalServiceFromEnv } from "../src/factories/create-retrieval-service.js";

describe("createRetrievalServiceFromEnv", () => {
  it("wires a VectorStoreRetriever instead of DummyVectorRetriever", () => {
    const service = createRetrievalServiceFromEnv({
      EMBEDDING_PROVIDER: "deterministic",
      EMBEDDING_MODEL: "deterministic-hash-v1",
      EMBEDDING_DIMENSIONS: "32",
      QDRANT_URL: "http://localhost:6333",
      QDRANT_COLLECTION: "knowledge_entities",
      QDRANT_VECTOR_SIZE: "32",
      QDRANT_DISTANCE: "Cosine"
    });

    expect(service).toBeInstanceOf(RetrievalService);

    const vectorRetriever = (
      service as unknown as {
        vector: unknown;
      }
    ).vector;

    expect(vectorRetriever).toBeInstanceOf(VectorStoreRetriever);
    expect(vectorRetriever).not.toBeInstanceOf(DummyVectorRetriever);
  });

  it("fails closed when embedding and Qdrant dimensions diverge", () => {
    expect(() =>
      createRetrievalServiceFromEnv({
        EMBEDDING_PROVIDER: "openai-compatible",
        EMBEDDING_DIMENSIONS: "1536",
        EMBEDDING_API_KEY: "secret",
        QDRANT_VECTOR_SIZE: "32"
      })
    ).toThrow(/must equal/);
  });
});
