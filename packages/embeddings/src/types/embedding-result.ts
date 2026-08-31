import type { EmbeddingVector } from "./embedding-vector.js";

export interface EmbeddingResult {

  vector: EmbeddingVector;

  model: string;

  dimensions: number;

  /**
   * Optional provider-specific metadata (tokens used, request id, etc.).
   */
  metadata?: Record<string, unknown>;

}
