import type {
  Evidence
} from "@knowledge/shared";

import type {
  RankingBreakdown
} from "./ranking-breakdown.js";

export interface RankedEvidence
extends Evidence {

  ranking: RankingBreakdown;

}