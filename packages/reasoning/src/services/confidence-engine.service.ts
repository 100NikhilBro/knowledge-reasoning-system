import type {
  EvidenceSet
} from "@knowledge/shared";

import type {
  ConfidenceEngine
} from "../contracts/confidence-engine.js";

export class DefaultConfidenceEngine
implements ConfidenceEngine {

  async calculate(

    evidenceSet: EvidenceSet

  ): Promise<number> {

    const evidence =

      evidenceSet.evidence;

    if (evidence.length === 0) {

      return 0;

    }

    const total =

      evidence.reduce(

        (sum, item) =>

          sum + item.score,

        0

      );

    return Number(

      (
        total /

        evidence.length

      ).toFixed(2)

    );

  }

}