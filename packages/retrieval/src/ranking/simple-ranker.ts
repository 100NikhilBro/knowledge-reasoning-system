import type { Ranker }
from "../contracts/ranker.js";

import type { RetrievalQuery }
from "../types/retrieval-query.js";

import type { RetrievalResult }
from "../types/retrieval-result.js";

import { calculateScore }
from "./score.js";

/**
 * Deterministic ranking over fused retrieval candidates.
 *
 * Primary key: retrieval/fusion score from graph/vector/merge.
 * Tie-break: existing calculateScore type prior, then entity.id.
 * Respects query.topK when provided.
 */
export class SimpleRanker
implements Ranker {

  async rank(

    query: RetrievalQuery,

    results: RetrievalResult[]

  ): Promise<RetrievalResult[]> {

    const ranked = [...results];

    ranked.sort((left, right) => {

      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const priorDiff =
        calculateScore(right.entity) -
        calculateScore(left.entity);

      if (priorDiff !== 0) {
        return priorDiff;
      }

      return left.entity.id.localeCompare(
        right.entity.id
      );

    });

    if (
      query.topK !== undefined &&
      Number.isInteger(query.topK) &&
      query.topK > 0
    ) {
      return ranked.slice(0, query.topK);
    }

    return ranked;

  }

}
