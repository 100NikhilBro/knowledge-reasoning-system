import type { RetrievalService as IRetrievalService }
from "../contracts/retrieval-service.js";

import type { VectorRetriever }
from "../contracts/vector-retriever.js";

import type { Ranker }
from "../contracts/ranker.js";

import type { GraphRetriever }
from "../contracts/retriever.js";

import { mergeResults }
from "../utils/merge-results.js";

import type { RetrievalQuery }
from "../types/retrieval-query.js";

import type { RetrievalResult }
from "../types/retrieval-result.js";

import { Neo4jGraphRetriever }
from "../graph/graph.retriever.js";

import { DummyVectorRetriever }
from "../vector/dummy.vector-retriever.js";

import { SimpleRanker }
from "../ranking/simple-ranker.js";

import { RetrievalError }
from "../errors/retrieval-error.js";

type GraphRetrievePort =
  Pick<GraphRetriever, "retrieve">;

/**
 * Hybrid Graph + Vector retrieval with independent graph/vector modes.
 *
 * Hybrid mode retrieves from available channels, fuses with per-source
 * normalization + provenance, and ranks. A single channel failure degrades
 * gracefully to the other channel.
 */
export class RetrievalService
implements IRetrievalService {

  constructor(

    private readonly graph: GraphRetrievePort =
      new Neo4jGraphRetriever(),

    private readonly vector: VectorRetriever =
      new DummyVectorRetriever(),

    private readonly ranker: Ranker =
      new SimpleRanker()

  ) {}

  async retrieve(
    query: RetrievalQuery
  ): Promise<RetrievalResult[]> {

    const mode =
      query.mode ?? "hybrid";

    try {

      switch (mode) {

        case "graph":
          return this.ranker.rank(
            query,
            await this.retrieveGraph(query)
          );

        case "vector":
          return this.ranker.rank(
            query,
            await this.retrieveVector(query)
          );

        case "hybrid":
          return this.retrieveHybrid(query);

        default: {
          const exhaustive: never = mode;
          throw new RetrievalError(
            "INVALID_QUERY",
            `Unsupported retrieval mode: ${String(exhaustive)}`
          );
        }

      }

    } catch (error) {

      if (error instanceof RetrievalError) {
        throw error;
      }

      throw new RetrievalError(
        "RETRIEVAL_FAILED",
        error instanceof Error
          ? error.message
          : "Retrieval failed",
        { cause: error instanceof Error ? error : undefined }
      );

    }

  }

  async retrieveGraph(
    query: RetrievalQuery
  ): Promise<RetrievalResult[]> {

    return this.graph.retrieve(query);

  }

  async retrieveVector(
    query: RetrievalQuery
  ): Promise<RetrievalResult[]> {

    return this.vector.retrieve(query);

  }

  private async retrieveHybrid(
    query: RetrievalQuery
  ): Promise<RetrievalResult[]> {

    const [graphResult, vectorResult] =
      await Promise.allSettled([
        this.graph.retrieve(query),
        this.vector.retrieve(query)
      ]);

    const graphResults =
      graphResult.status === "fulfilled"
        ? graphResult.value
        : [];

    const vectorResults =
      vectorResult.status === "fulfilled"
        ? vectorResult.value
        : [];

    if (
      graphResult.status === "rejected" &&
      vectorResult.status === "rejected"
    ) {
      throw new RetrievalError(
        "RETRIEVAL_FAILED",
        "Both graph and vector retrieval failed",
        {
          cause:
            graphResult.reason instanceof Error
              ? graphResult.reason
              : undefined
        }
      );
    }

    /*
     * Graceful degradation: one channel may fail; the other still contributes.
     */
    const merged =
      mergeResults(
        graphResults,
        vectorResults,
        query.query
      );

    return this.ranker.rank(
      query,
      merged
    );

  }

}
