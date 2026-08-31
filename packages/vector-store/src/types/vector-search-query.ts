import type { EmbeddingVector } from "@knowledge/embeddings";

export interface VectorSearchQuery {

  /**
   * Precomputed query embedding (from EmbeddingProvider / EmbeddingService).
   */
  vector: EmbeddingVector;

  topK?: number;

  /**
   * Optional minimum similarity score (provider-specific).
   */
  scoreThreshold?: number;

}
