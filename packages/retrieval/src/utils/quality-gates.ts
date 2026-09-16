import type { RetrievalQuery } from "../types/retrieval-query.js";
import type { RetrievalResult } from "../types/retrieval-result.js";

import { analyzeHybridQuery } from "./analyze-hybrid-query.js";

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

function searchableText(
  result: RetrievalResult
): string {

  return [
    result.entity.id,
    result.entity.label,
    result.entity.source,
    ...Object.values(result.entity.properties ?? {})
  ]
    .filter(
      value =>
        typeof value === "string" ||
        typeof value === "number"
    )
    .join(" ")
    .toLowerCase();

}

function compactKey(value: string): string {
  return value.toLowerCase().replace(/[\s_\-:/]+/g, "");
}

/**
 * Lightweight quality gates before final ranking.
 * Rejects obviously incompatible / out-of-corpus noise without owning P3 verification.
 */
export function applyRetrievalQualityGates(
  results: RetrievalResult[],
  query: RetrievalQuery
): RetrievalResult[] {

  if (query.intent === "OUT_OF_CORPUS") {
    return [];
  }

  if (results.length === 0) {
    return results;
  }

  const analysis =
    analyzeHybridQuery(query.query, {
      intent: query.intent
    });

  const requiredEntities =
    (query.entities ?? [])
      .map(item => item.trim().toLowerCase())
      .filter(Boolean);

  const claimTerms =
    (query.claims ?? [])
      .flatMap(claim => [
        claim.subject,
        claim.object,
        claim.predicate
      ])
      .filter((item): item is string => Boolean(item?.trim()))
      .map(item => item.trim().toLowerCase());

  const hasHardConstraints =
    requiredEntities.length > 0 ||
    claimTerms.length > 0 ||
    analysis.lexicalSignals.length > 0 ||
    analysis.topicCodes.length > 0;

  const gated =
    results.filter(result => {
      const searchable =
        searchableText(result);

      const compact =
        compactKey(searchable);

      const lexicalHit =
        analysis.lexicalSignals.some(signal =>
          searchable.includes(signal.toLowerCase()) ||
          compact.includes(compactKey(signal))
        ) ||
        analysis.topicCodes.some(code =>
          searchable.includes(code) ||
          compact.includes(compactKey(code))
        );

      if (lexicalHit) {
        return true;
      }

      const sources =
        asSources(result.metadata?.sources);

      const dual =
        sources.length > 1;

      if (dual) {
        return true;
      }

      const entityHit =
        requiredEntities.some(entity =>
          searchable.includes(entity) ||
          compact.includes(compactKey(entity))
        );

      if (entityHit) {
        return true;
      }

      const claimHit =
        claimTerms.some(term =>
          term !== "improves" &&
          term !== "causal" &&
          term !== "supports" &&
          (
            searchable.includes(term) ||
            compact.includes(compactKey(term))
          )
        );

      if (claimHit) {
        return true;
      }

      /*
       * Expansion neighbors without query alignment should not survive alone,
       * unless they carry an attested graph relationship (relationship-aware
       * expansion). Entity co-occurrence without an edge still fails later.
       */
      if (result.metadata?.expanded === true && hasHardConstraints) {
        if (result.relationship) {
          return true;
        }
        return false;
      }

      /*
       * When the query names hard constraints, drop candidates that miss them
       * unless they are unusually strong (preserve recall for paraphrases).
       */
      if (hasHardConstraints) {
        if (result.score < 0.2) {
          return false;
        }

        if (
          analysis.topicCodes.length > 0 &&
          !analysis.topicCodes.some(code =>
            searchable.includes(code) ||
            compact.includes(compactKey(code))
          ) &&
          result.score < 0.35
        ) {
          return false;
        }
      }

      return true;
    });

  /*
   * Prefer empty over forcing weak incompatible noise when constraints exist.
   */
  if (
    gated.length === 0 &&
    hasHardConstraints &&
    (
      query.intent === "DIRECT_RELATIONSHIP" ||
      query.intent === "IMPLICATION" ||
      query.intent === "BRIDGE_RELATIONSHIP"
    )
  ) {
    return gated;
  }

  return gated.length > 0 ? gated : results;

}
