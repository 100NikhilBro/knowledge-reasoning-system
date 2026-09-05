import type {
  EvidenceSet
} from "@knowledge/shared";

import type {
  ConfidenceEngine
} from "../contracts/confidence-engine.js";

import {
  computeGroundedAnswerConfidence
} from "../utils/compute-grounded-confidence.js";

/**
 * Public answer confidence engine.
 *
 * Returns grounded-answer confidence in [0, 1].
 * Does not expose raw retrieval / graph ranking magnitudes.
 */
export class DefaultConfidenceEngine
implements ConfidenceEngine {

  async calculate(

    evidenceSet: EvidenceSet

  ): Promise<number> {

    return computeGroundedAnswerConfidence(
      evidenceSet
    );

  }

}
