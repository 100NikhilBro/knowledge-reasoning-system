import {
  buildRankingExplanation
} from "../utils/build-ranking-explanation.js";

import type {
  Evidence
} from "@knowledge/shared";

import type {
  RankingConfig
} from "../contracts/ranking-config.js";

import {
  DEFAULT_RANKING_CONFIG
} from "../utils/default-ranking-config.js";

import {
  scoreEvidence
} from "../utils/score-evidence.js";

import type {
  RankingExplanation
} from "../types/ranking-explanation.js";

export class DefaultEvidenceRanker {

  constructor(

    private readonly config: RankingConfig =
      DEFAULT_RANKING_CONFIG

  ) {}

  rank(

    evidence: Evidence

  ): Evidence {

    return {

      ...evidence,

      score: scoreEvidence(

        evidence,

        this.config

      )

    };

  }

  rankAll(

    evidence: Evidence[]

  ): Evidence[] {

    return evidence.map(

      item =>

        this.rank(item)

    );

  }

  explain(

  evidence: Evidence

): RankingExplanation {

  return buildRankingExplanation(

    evidence

  );

}

}