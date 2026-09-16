import type { RetrievalResult }
from "../types/retrieval-result.js";

import {
  analyzeHybridQuery,
  type HybridPreference
} from "./analyze-hybrid-query.js";

function asSources(
  value: unknown
): Array<"graph" | "vector"> {

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is "graph" | "vector" =>
      item === "graph" || item === "vector"
  );

}

/**
 * Weighted Reciprocal Rank Fusion over graph + vector ranked lists.
 * Rank-based — avoids assuming comparable raw score scales.
 */
export function mergeResultsWrrf(

  graphResults: RetrievalResult[],

  vectorResults: RetrievalResult[],

  query = "",

  options?: {
    k?: number;
    intent?: string;
  }

): RetrievalResult[] {

  const analysis =
    analyzeHybridQuery(query, {
      intent: options?.intent
    });

  const k =
    options?.k ?? 60;

  const weights =
    preferenceWeights(analysis.preference);

  const scores =
    new Map<string, {
      entity: RetrievalResult["entity"];
      graphRank?: number;
      vectorRank?: number;
      graphScore?: number;
      vectorScore?: number;
      metadata: Record<string, unknown>;
    }>();

  graphResults.forEach((result, index) => {
    const rank = index + 1;
    scores.set(result.entity.id, {
      entity: result.entity,
      graphRank: rank,
      graphScore: result.score,
      metadata: {
        ...(result.metadata ?? {}),
        sources: ["graph"]
      }
    });
  });

  vectorResults.forEach((result, index) => {
    const rank = index + 1;
    const existing =
      scores.get(result.entity.id);

    if (!existing) {
      scores.set(result.entity.id, {
        entity: result.entity,
        vectorRank: rank,
        vectorScore: result.score,
        metadata: {
          ...(result.metadata ?? {}),
          sources: ["vector"]
        }
      });
      return;
    }

    existing.vectorRank = rank;
    existing.vectorScore = result.score;
    existing.metadata = {
      ...existing.metadata,
      ...(result.metadata ?? {}),
      sources: ["graph", "vector"]
    };
  });

  const fused: RetrievalResult[] = [];

  for (const entry of scores.values()) {
    const graphContribution =
      entry.graphRank !== undefined
        ? weights.graph / (k + entry.graphRank)
        : 0;

    const vectorContribution =
      entry.vectorRank !== undefined
        ? weights.vector / (k + entry.vectorRank)
        : 0;

    const dualBonus =
      entry.graphRank !== undefined &&
      entry.vectorRank !== undefined
        ? weights.dualBonus / (k + 1)
        : 0;

    const score =
      graphContribution + vectorContribution + dualBonus;

    const sources =
      asSources(entry.metadata.sources);

    const primarySource =
      entry.vectorRank !== undefined &&
      (
        entry.graphRank === undefined ||
        entry.vectorRank < entry.graphRank
      )
        ? "vector"
        : "graph";

    fused.push({
      entity: entry.entity,
      score,
      source: primarySource,
      metadata: {
        ...entry.metadata,
        sources,
        graphScore: entry.graphScore,
        vectorScore: entry.vectorScore,
        graphRank: entry.graphRank,
        vectorRank: entry.vectorRank,
        hybridPreference: analysis.preference,
        fusion: "wrrf"
      }
    });
  }

  return fused.sort((left, right) => right.score - left.score);

}

function preferenceWeights(
  preference: HybridPreference
): { graph: number; vector: number; dualBonus: number } {

  switch (preference) {
    case "graph":
      return { graph: 0.7, vector: 0.3, dualBonus: 0.08 };
    case "vector":
      return { graph: 0.3, vector: 0.7, dualBonus: 0.08 };
    default:
      return { graph: 0.5, vector: 0.5, dualBonus: 0.1 };
  }

}
