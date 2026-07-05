import type {
  Evidence
} from "@knowledge/shared";

import type {
  RankingExplanation
} from "../types/ranking-explanation.js";

export interface EvidenceRanker {

  rank(

    evidence: Evidence

  ): Evidence;

  rankAll(

    evidence: Evidence[]

  ): Evidence[];

  explain(

    evidence: Evidence

  ): RankingExplanation;

}