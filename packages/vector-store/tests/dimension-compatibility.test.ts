import { describe, expect, it } from "vitest";

import { assertEmbeddingQdrantDimensions }
from "../src/config/assert-embedding-qdrant-dimensions.js";

import { VectorStoreError }
from "../src/errors/vector-store-error.js";

import { extractCollectionVectorSize }
from "../src/utils/collection-vector-size.js";

describe("assertEmbeddingQdrantDimensions", () => {

  it("passes when embedding and qdrant sizes match", () => {

    expect(() =>
      assertEmbeddingQdrantDimensions({
        EMBEDDING_PROVIDER: "deterministic",
        EMBEDDING_DIMENSIONS: "32",
        QDRANT_VECTOR_SIZE: "32"
      })
    ).not.toThrow();

  });

  it("fails closed on dimension mismatch", () => {

    expect(() =>
      assertEmbeddingQdrantDimensions({
        EMBEDDING_PROVIDER: "openai-compatible",
        EMBEDDING_DIMENSIONS: "1536",
        EMBEDDING_API_KEY: "secret",
        QDRANT_VECTOR_SIZE: "32"
      })
    ).toThrow(VectorStoreError);

    expect(() =>
      assertEmbeddingQdrantDimensions({
        EMBEDDING_PROVIDER: "openai-compatible",
        EMBEDDING_DIMENSIONS: "1536",
        EMBEDDING_API_KEY: "secret",
        QDRANT_VECTOR_SIZE: "32"
      })
    ).toThrow(/must equal/);

  });

});

describe("extractCollectionVectorSize", () => {

  it("reads unnamed vector size from Qdrant collection info", () => {

    expect(
      extractCollectionVectorSize({
        result: {
          config: {
            params: {
              vectors: {
                size: 1536,
                distance: "Cosine"
              }
            }
          }
        }
      })
    ).toBe(1536);

  });

  it("reads the first named vector size", () => {

    expect(
      extractCollectionVectorSize({
        config: {
          params: {
            vectors: {
              default: {
                size: 768,
                distance: "Cosine"
              }
            }
          }
        }
      })
    ).toBe(768);

  });

});
