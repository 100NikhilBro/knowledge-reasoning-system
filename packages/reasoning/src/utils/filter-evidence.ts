// import type {
//   Evidence
// } from "@knowledge/shared";

// export function filterEvidence(

//   evidence: Evidence[],

//   threshold = 0.5

// ): Evidence[] {

//   return evidence.filter(

//     item => item.score >= threshold

//   );

// }



import type {

  Evidence

} from "@knowledge/shared";

import type {

  RankingConfig

} from "../contracts/ranking-config.js";

import {

  DEFAULT_RANKING_CONFIG

} from "./default-ranking-config.js";

export function filterEvidence(

  evidence: Evidence[],

  config: RankingConfig = DEFAULT_RANKING_CONFIG

): Evidence[] {

  return evidence.filter(

    item =>

      item.score >=

      config.minimumScore

  );

}