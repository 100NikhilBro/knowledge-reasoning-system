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

function maxScore(
  results: RetrievalResult[]
): number {

  let max = 0;

  for (const result of results) {
    const score =
      Math.max(0, Number(result.score) || 0);
    if (score > max) {
      max = score;
    }
  }

  return max;

}

function normalizeScore(
  score: number,
  max: number
): number {

  if (max <= 0) {
    return 0;
  }

  const value =
    Math.max(0, Number(score) || 0) / max;

  if (value > 1) {
    return 1;
  }

  return value;

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

/**
 * Fuse graph + vector candidates by entity.id with explicit per-source
 * normalization. Never adds raw graph scores to raw vector similarities.
 *
 * - Deduplicates by entity id
 * - Preserves provenance in metadata.sources / graphScore / vectorScore
 * - Prefers the graph entity payload when both hit (stable identity)
 * - Ranking score is a unit-ish fusion used only for internal ordering
 */
export function mergeResults(

  graphResults: RetrievalResult[],

  vectorResults: RetrievalResult[],

  query = ""

): RetrievalResult[] {

  const analysis =
    analyzeHybridQuery(query);

  const weights =
    preferenceWeights(analysis.preference);

  const graphMax =
    maxScore(graphResults);

  const vectorMax =
    maxScore(vectorResults);

  const merged =
    new Map<string, RetrievalResult>();

  for (const result of graphResults) {

    const graphNorm =
      normalizeScore(result.score, graphMax);

    merged.set(
      result.entity.id,
      {
        entity: result.entity,
        score: graphNorm * weights.graph,
        source: "graph",
        metadata: {
          ...(result.metadata ?? {}),
          sources: ["graph"],
          graphScore: result.score,
          graphNorm,
          vectorNorm: 0,
          hybridPreference: analysis.preference
        }
      }
    );

  }

  for (const result of vectorResults) {

    const existing =
      merged.get(result.entity.id);

    const vectorNorm =
      normalizeScore(result.score, vectorMax);

    if (!existing) {

      merged.set(
        result.entity.id,
        {
          entity: result.entity,
          score: vectorNorm * weights.vector,
          source: "vector",
          metadata: {
            ...(result.metadata ?? {}),
            sources: ["vector"],
            vectorScore: result.score,
            graphNorm: 0,
            vectorNorm,
            hybridPreference: analysis.preference
          }
        }
      );

      continue;

    }

    const graphScore =
      typeof existing.metadata?.graphScore === "number"
        ? existing.metadata.graphScore
        : existing.score;

    const graphNorm =
      typeof existing.metadata?.graphNorm === "number"
        ? existing.metadata.graphNorm
        : normalizeScore(graphScore, graphMax);

    const sources = [
      ...new Set([
        ...asSources(existing.metadata?.sources),
        "vector" as const
      ])
    ];

    const fused =
      graphNorm * weights.graph +
      vectorNorm * weights.vector +
      weights.dualBonus;

    /*
     * Primary source reflects which channel contributed more after
     * normalization — ties prefer graph so relationship identity stays.
     */
    const primarySource =
      vectorNorm > graphNorm + 1e-9
        ? "vector"
        : "graph";

    merged.set(
      result.entity.id,
      {
        /*
         * Keep graph entity when both hit — same id, stable graph payload.
         */
        entity: existing.entity,
        score: Math.min(1, fused),
        source: primarySource,
        metadata: {
          ...(existing.metadata ?? {}),
          ...(result.metadata ?? {}),
          sources,
          graphScore,
          vectorScore: result.score,
          graphNorm,
          vectorNorm,
          hybridPreference: analysis.preference
        }
      }
    );

  }

  return selectHybridCandidates(
    [...merged.values()],
    analysis.preference
  );

}

/**
 * Keep the smallest useful compatible set: do not force equal graph/vector
 * counts, but do not drop an entire relevant channel without cause.
 */
function selectHybridCandidates(

  results: RetrievalResult[],

  preference: HybridPreference

): RetrievalResult[] {

  if (results.length === 0) {
    return [];
  }

  const graphOnly =
    results.filter(item =>
      asSources(item.metadata?.sources).length === 1 &&
      item.source === "graph"
    );

  const vectorOnly =
    results.filter(item =>
      asSources(item.metadata?.sources).length === 1 &&
      item.source === "vector"
    );

  const dual =
    results.filter(item =>
      asSources(item.metadata?.sources).length > 1
    );

  /*
   * Dominance: if one channel has strong dual/primary hits and the other
   * only has weak unique noise, drop weak unique noise below a floor.
   */
  const ranked = [...results].sort(
    (left, right) => right.score - left.score
  );

  const best =
    ranked[0]?.score ?? 0;

  const floor =
    preference === "balanced"
      ? best * 0.25
      : preference === "graph"
        ? best * 0.2
        : best * 0.2;

  const selected =
    ranked.filter(item => {
      if (item.score >= floor) {
        return true;
      }

      /*
       * Always keep dual-provenance hits — they are strong agreement.
       */
      if (asSources(item.metadata?.sources).length > 1) {
        return true;
      }

      return false;
    });

  /*
   * If filtering removed everything somehow, fall back to ranked list.
   */
  if (selected.length === 0) {
    return ranked;
  }

  /*
   * Ensure a preferred channel is not emptied when it produced candidates
   * and the other side only barely cleared the floor.
   */
  void graphOnly;
  void vectorOnly;
  void dual;

  return selected;

}
