import type { RetrievalResult }
from "../types/retrieval-result.js";

export function mergeResults(

  graphResults: RetrievalResult[],

  vectorResults: RetrievalResult[]

): RetrievalResult[] {

  const merged = new Map<string, RetrievalResult>();

  for (const result of [

    ...graphResults,

    ...vectorResults

  ]) {

    const existing = merged.get(
      result.entity.id
    );

    if (

      !existing ||

      result.score > existing.score

    ) {

      merged.set(

        result.entity.id,

        result

      );

    }

  }

  return [

    ...merged.values()

  ];

}