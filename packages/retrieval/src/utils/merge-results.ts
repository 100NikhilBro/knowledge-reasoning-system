import type { RetrievalResult }
from "../types/retrieval-result.js";

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
 * Merge graph and vector candidates by entity.id.
 *
 * Deterministic fusion when both sources hit the same entity:
 * score = graphScore + vectorScore (preserves both signals).
 * Primary `source` is the side with the higher individual score
 * (ties prefer graph for stability).
 */
export function mergeResults(

  graphResults: RetrievalResult[],

  vectorResults: RetrievalResult[]

): RetrievalResult[] {

  const merged =
    new Map<string, RetrievalResult>();

  for (const result of graphResults) {

    merged.set(
      result.entity.id,
      {
        entity: result.entity,
        score: result.score,
        source: "graph",
        metadata: {
          ...(result.metadata ?? {}),
          sources: ["graph"],
          graphScore: result.score
        }
      }
    );

  }

  for (const result of vectorResults) {

    const existing =
      merged.get(result.entity.id);

    if (!existing) {

      merged.set(
        result.entity.id,
        {
          entity: result.entity,
          score: result.score,
          source: "vector",
          metadata: {
            ...(result.metadata ?? {}),
            sources: ["vector"],
            vectorScore: result.score
          }
        }
      );

      continue;

    }

    const graphScore =
      typeof existing.metadata?.graphScore === "number"
        ? existing.metadata.graphScore
        : existing.score;

    const vectorScore =
      result.score;

    const sources = [
      ...new Set([
        ...asSources(existing.metadata?.sources),
        "vector" as const
      ])
    ];

    const primarySource =
      vectorScore > graphScore
        ? "vector"
        : "graph";

    merged.set(
      result.entity.id,
      {
        entity: existing.entity,
        score: graphScore + vectorScore,
        source: primarySource,
        metadata: {
          ...(existing.metadata ?? {}),
          ...(result.metadata ?? {}),
          sources,
          graphScore,
          vectorScore
        }
      }
    );

  }

  return [
    ...merged.values()
  ];

}
