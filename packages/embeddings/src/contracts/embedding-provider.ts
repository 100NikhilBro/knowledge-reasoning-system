import type { EmbeddingVector } from "../types/embedding-vector.js";

/**
 * Replaceable embedding backend.
 *
 * Implementations must return one vector per input text,
 * each of length `dimensions`.
 */
export interface EmbeddingProvider {

  readonly id: string;

  readonly model: string;

  readonly dimensions: number;

  /**
   * Embed one or more documents for indexing.
   */
  embedDocuments(
    texts: string[]
  ): Promise<EmbeddingVector[]>;

  /**
   * Embed a single search query.
   */
  embedQuery(
    text: string
  ): Promise<EmbeddingVector>;

}
