import type {

  RankingConfig

} from "../contracts/ranking-config.js";

export const DEFAULT_RANKING_CONFIG: RankingConfig = {

  minimumScore: 0.5,

  weights: {

    retrieval: 0.6,

    trust: 0.2,

    confidence: 0.2

  }

};