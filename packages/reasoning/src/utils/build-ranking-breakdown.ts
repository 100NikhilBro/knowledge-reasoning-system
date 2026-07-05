import type {
  Evidence
} from "@knowledge/shared";

import type {
  RankingConfig
} from "../contracts/ranking-config.js";

import {
  DEFAULT_RANKING_CONFIG
} from "./default-ranking-config.js";

import {
  getSourceTrust
} from "./get-source-trust.js";

import type {
  RankingBreakdown
} from "../types/ranking-breakdown.js";

export function buildRankingBreakdown(

  evidence: Evidence,

  config: RankingConfig = DEFAULT_RANKING_CONFIG

): RankingBreakdown {

  const retrieval =

    evidence.score *

    config.weights.retrieval;

  const trust =

    getSourceTrust(

      evidence.source

    ) *

    config.weights.trust;

  const confidence =

    evidence.entity.confidence *

    config.weights.confidence;

  return {

    retrieval,

    trust,

    confidence,

    final:

      retrieval +

      trust +

      confidence

  };

}