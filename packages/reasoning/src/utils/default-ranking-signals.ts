import type {

  RankingSignals

} from "../types/ranking-signals.js";

export const DEFAULT_RANKING_SIGNALS: RankingSignals = {

  retrieval: 0.5,

  graph: 0.1,

  trust: 0.15,

  confidence: 0.15,

  freshness: 0.05,

  verification: 0.05

};