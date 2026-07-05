// // import type {
// //   Evidence
// // } from "@knowledge/shared";

// // import {

// //   getSourceTrust

// // } from "./get-source-trust.js";

// // import {

// //   buildRankingBreakdown

// // } from "./build-ranking-breakdown.js";

// // export interface ScoreWeights {

// //   retrieval: number;

// //   graph: number;

// //   trust: number;

// //   confidence: number;

// // }


// // const DEFAULT_WEIGHTS: ScoreWeights = {

// //   retrieval: 0.6,

// //   graph: 0,

// //   trust: 0.2,

// //   confidence: 0.2

// // };

// // export function scoreEvidence(

// //   evidence: Evidence,

// //   weights = DEFAULT_WEIGHTS

// // ): number {

// //   const trust =

// //   getSourceTrust(

// //     evidence.source

// //   );

// // const confidence =

// //   evidence.entity.confidence;

// // return (

// //   evidence.score *

// //     weights.retrieval +

// //   trust *

// //     weights.trust +

// //   confidence *

// //     weights.confidence

// // );

// // }



// import type {
//   Evidence
// } from "@knowledge/shared";

// import {
//   buildRankingBreakdown
// } from "./build-ranking-breakdown.js";

// export interface ScoreWeights {

//   retrieval: number;

//   graph: number;

//   trust: number;

//   confidence: number;

// }

// const DEFAULT_WEIGHTS: ScoreWeights = {

//   retrieval: 0.6,

//   graph: 0,

//   trust: 0.2,

//   confidence: 0.2

// };

// export function scoreEvidence(

//   evidence: Evidence,

//   weights = DEFAULT_WEIGHTS

// ): number {

//   const breakdown =

//     buildRankingBreakdown(

//       evidence,

//       weights

//     );

//   return (

//     breakdown.final

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

import {

  getSourceTrust

} from "./get-source-trust.js";

export function scoreEvidence(

  evidence: Evidence,

  config: RankingConfig = DEFAULT_RANKING_CONFIG

): number {

  const trust =

    getSourceTrust(

      evidence.source

    );

  const confidence =

    evidence.entity.confidence;

  return (

    evidence.score *

      config.weights.retrieval +

    trust *

      config.weights.trust +

    confidence *

      config.weights.confidence

  );

}