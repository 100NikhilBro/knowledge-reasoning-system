// import type {
//   Evidence
// } from "@knowledge/shared";

// export function scoreEvidence(
//   evidence: Evidence
// ): number {

//   return evidence.score;

// }


import type {
  Evidence
} from "@knowledge/shared";

export interface ScoreWeights {

  retrieval: number;

  graph: number;

}

const DEFAULT_WEIGHTS: ScoreWeights = {

  retrieval: 1,

  graph: 0

};

export function scoreEvidence(

  evidence: Evidence,

  weights = DEFAULT_WEIGHTS

): number {

  return (

    evidence.score * weights.retrieval

  );

}