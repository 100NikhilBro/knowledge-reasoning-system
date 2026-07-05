import type {
  Evidence
} from "@knowledge/shared";

import {
  getSourceTrust
} from "./get-source-trust.js";

import type {
  RankingExplanation
} from "../types/ranking-explanation.js";

export function buildRankingExplanation(

  evidence: Evidence

): RankingExplanation {

  return {

    retrieval:

      evidence.score,

    trust:

      getSourceTrust(

        evidence.source

      ),

    confidence:

      evidence.entity.confidence,

    finalScore:

      evidence.score

  };

}