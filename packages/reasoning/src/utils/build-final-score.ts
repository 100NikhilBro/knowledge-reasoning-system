// import type {
//   Evidence
// } from "@knowledge/shared";

// import {
//   scoreEvidence
// } from "./score-evidence.js";

// export function buildFinalScore(

//   evidence: Evidence

// ): Evidence {

//   return {

//     ...evidence,

//     score:

//       scoreEvidence(

//         evidence

//       )

//   };

// }


/**
 * @deprecated
 * Use DefaultEvidenceRanker instead.
 */

import type {
  Evidence
} from "@knowledge/shared";

import {
  DefaultEvidenceRanker
} from "../services/evidence-ranker.service.js";

const ranker =

  new DefaultEvidenceRanker();

export function buildFinalScore(

  evidence: Evidence

): Evidence {

  return ranker.rank(

    evidence

  );

}