import { resolveEmbeddingConfig } from "@knowledge/embeddings";

import { VectorStoreError } from "../errors/vector-store-error.js";

import { resolveVectorStoreConfig }
from "./resolve-vector-store-config.js";

/**
 * Fail closed when embedding output dims and Qdrant collection size diverge.
 *
 * Mixing deterministic (often 32-d) vectors with semantic vectors in the same
 * collection produces silently wrong retrieval — never allow that at boot.
 */
export function assertEmbeddingQdrantDimensions(
  env: NodeJS.ProcessEnv = process.env
): void {

  const embedding = resolveEmbeddingConfig(env);
  const store = resolveVectorStoreConfig(env);

  if (embedding.dimensions !== store.vectorSize) {
    throw new VectorStoreError(
      "DIMENSION_MISMATCH",
      `EMBEDDING_DIMENSIONS (${embedding.dimensions}) must equal ` +
        `QDRANT_VECTOR_SIZE (${store.vectorSize}). ` +
        `Update both to the semantic model size, recreate the Qdrant collection, ` +
        `and reindex entities. Do not mix deterministic and semantic vectors.`
    );
  }

}
