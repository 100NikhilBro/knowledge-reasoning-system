import type { VectorStoreService } from "@knowledge/vector-store";

import type { VectorRetriever } from "../contracts/vector-retriever.js";
import type { RetrievalQuery } from "../types/retrieval-query.js";
import type { RetrievalResult } from "../types/retrieval-result.js";

import { RetrievalError } from "../errors/retrieval-error.js";

/**
 * Vector retrieval backed by VectorStoreService
 * (embeddings + VectorStore — no direct Qdrant access).
 */
export class VectorStoreRetriever
  implements VectorRetriever {

  constructor(
    private readonly vectorStore: VectorStoreService
  ) {}

  async retrieve(
    query: RetrievalQuery
  ): Promise<RetrievalResult[]> {

    const text =
      query.query?.trim() ?? "";

    if (text.length === 0) {
      return [];
    }

    const topK = query.topK;

    if (
      topK !== undefined &&
      (!Number.isInteger(topK) || topK <= 0)
    ) {
      throw new RetrievalError(
        "INVALID_QUERY",
        "topK must be a positive integer when provided"
      );
    }

    try {

      const results =
        await this.vectorStore.searchByText(
          text,
          {
            topK
          }
        );

      if (!Array.isArray(results) || results.length === 0) {
        return [];
      }

      return results.map(result => ({
        entity: result.entity,
        score: result.score,
        source: "vector" as const,
        ...(result.metadata
          ? { metadata: result.metadata }
          : {})
      }));

    } catch (error) {

      if (error instanceof RetrievalError) {
        throw error;
      }

      throw new RetrievalError(
        "VECTOR_RETRIEVAL_FAILED",
        error instanceof Error
          ? error.message
          : "Vector retrieval failed",
        { cause: error instanceof Error ? error : undefined }
      );

    }

  }

}
