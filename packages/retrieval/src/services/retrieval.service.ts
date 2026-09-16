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

import { mergeResultsWrrf }
from "../utils/merge-results-wrrf.js";

import { applyRetrievalQualityGates }
from "../utils/quality-gates.js";

import { analyzeHybridQuery }
from "../utils/analyze-hybrid-query.js";

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
  Pick<GraphRetriever, "retrieve"> & {
    expandFromSeeds?: Neo4jGraphRetriever["expandFromSeeds"];
  };

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

  private resolveCandidateK(
    query: RetrievalQuery
  ): number {

    if (
      query.candidateK !== undefined &&
      Number.isInteger(query.candidateK) &&
      query.candidateK > 0
    ) {
      return query.candidateK;
    }

    const topK =
      query.topK !== undefined &&
      Number.isInteger(query.topK) &&
      query.topK > 0
        ? query.topK
        : 5;

    return Math.max(topK * 3, 15);

  }

  private async retrieveHybrid(
    query: RetrievalQuery
  ): Promise<RetrievalResult[]> {

    const candidateK =
      this.resolveCandidateK(query);

    const channelQuery: RetrievalQuery = {
      ...query,
      topK: candidateK
    };

    const [graphResult, vectorResult] =
      await Promise.allSettled([
        this.graph.retrieve(channelQuery),
        this.vector.retrieve(channelQuery)
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

    const fusion =
      query.fusion ?? "weighted";

    const merged =
      fusion === "wrrf"
        ? mergeResultsWrrf(
            graphResults,
            vectorResults,
            query.query,
            { intent: query.intent }
          )
        : mergeResults(
            graphResults,
            vectorResults,
            query.query,
            { intent: query.intent }
          );

    const gated =
      applyRetrievalQualityGates(merged, query);

    const expanded =
      await this.expandGraphCandidates(
        gated,
        query
      );

    const reGated =
      applyRetrievalQualityGates(expanded, query);

    const channelsSucceeded: Array<"graph" | "vector"> = [];

    if (graphResult.status === "fulfilled") {
      channelsSucceeded.push("graph");
    }

    if (vectorResult.status === "fulfilled") {
      channelsSucceeded.push("vector");
    }

    const channelMeta = {
      channelsAttempted: ["graph", "vector"],
      channelsSucceeded,
      candidateK,
      fusion,
      retrievalLatencyHint: {
        graphOk: graphResult.status === "fulfilled",
        vectorOk: vectorResult.status === "fulfilled"
      }
    };

    const withProvenance =
      reGated.map(result => ({
        ...result,
        metadata: {
          ...(result.metadata ?? {}),
          ...channelMeta,
          intent: query.intent ?? result.metadata?.intent
        }
      }));

    return this.ranker.rank(
      query,
      withProvenance
    );

  }

  /**
   * Bounded 1-hop expansion for relationship-oriented intents only.
   */
  private async expandGraphCandidates(
    results: RetrievalResult[],
    query: RetrievalQuery
  ): Promise<RetrievalResult[]> {

    const analysis =
      analyzeHybridQuery(query.query, {
        intent: query.intent
      });

    const shouldExpand =
      analysis.preference === "graph" ||
      query.intent === "CONNECTED_RELATIONSHIP" ||
      query.intent === "BRIDGE_RELATIONSHIP" ||
      query.intent === "RELATIONSHIP" ||
      query.intent === "COMPOUND" ||
      query.intent === "IMPLICATION";

    if (
      !shouldExpand ||
      typeof this.graph.expandFromSeeds !== "function" ||
      results.length === 0
    ) {
      return results;
    }

    const seedLimit = 5;
    const seeds =
      results
        .slice(0, seedLimit)
        .map(item => item.entity);

    let expandedEntities;
    try {
      expandedEntities =
        await this.graph.expandFromSeeds(seeds, {
          maxNeighborsPerNode: 4,
          maxTotal: 12
        });
    } catch {
      return results;
    }

    if (expandedEntities.length === 0) {
      return results;
    }

    const seen =
      new Set(results.map(item => item.entity.id));

    const extras: RetrievalResult[] = [];

    for (const entity of expandedEntities) {
      if (seen.has(entity.id)) {
        continue;
      }

      seen.add(entity.id);

      extras.push({
        entity,
        /*
         * Expansion neighbors rank below fused seeds; SimpleRanker + topK
         * decide final membership.
         */
        score: 0.05,
        source: "graph",
        metadata: {
          channel: "graph",
          sources: ["graph"],
          expanded: true,
          expansionDepth: 1
        }
      });
    }

    return [...results, ...extras];

  }

}
