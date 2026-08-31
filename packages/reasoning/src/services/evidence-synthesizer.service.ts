// import type {
//   EvidenceSet
// } from "@knowledge/shared";

// import type {
//   EvidenceSynthesizer
// } from "../contracts/evidence-synthesizer.js";

// import {

//   deduplicateEvidence

// } from "../utils/deduplicate-evidence.js";

// import {

//   filterEvidence

// } from "../utils/filter-evidence.js";

// import {

//   DefaultEvidenceRanker

// } from "./evidence-ranker.service.js";

// import {

//   buildFinalScore

// } from "../utils/build-final-score.js";

// import {

//   sortEvidence

// } from "../utils/sort-evidence.js";

// import { scoreEvidence } from "../utils/score-evidence.js";


// import {

//   verifyEvidence

// } from "../utils/verify-evidence.js";


// import {

//   detectConflicts

// } from "../utils/detect-conflicts.js";

// import {

//   resolveConflicts

// } from "../utils/resolve-conflicts.js";





// export class DefaultEvidenceSynthesizer

// implements EvidenceSynthesizer {

//   async synthesize(

//     evidence: EvidenceSet

//   ): Promise<EvidenceSet> {

//     const conflicts =

//   detectConflicts(

//     evidence.evidence

//   );

// const resolution =

//   resolveConflicts(

//     evidence.evidence,

//     conflicts

//   );

// const verification =

//   verifyEvidence(

//     resolution.resolved

//   );

// const deduplicated =

//   deduplicateEvidence(

//     verification.valid

//   );
//     const filtered =

//       filterEvidence(

//         deduplicated

//       );

//       const rescored =

//   this.ranker.rankAll(

//     filtered

//   );



//     const sorted =
// sortEvidence(rescored);


//     return {

//       evidence: sorted

//     };

//   }

// }



import type {
  EvidenceSet
} from "@knowledge/shared";

import type {
  EvidenceSynthesizer
} from "../contracts/evidence-synthesizer.js";

import {
  deduplicateEvidence
} from "../utils/deduplicate-evidence.js";

import {
  filterEvidence
} from "../utils/filter-evidence.js";

import {
  sortEvidence
} from "../utils/sort-evidence.js";

import {
  verifyEvidence
} from "../utils/verify-evidence.js";

import {
  detectConflicts
} from "../utils/detect-conflicts.js";

import {
  resolveConflicts
} from "../utils/resolve-conflicts.js";

import {
  DefaultEvidenceRanker
} from "./evidence-ranker.service.js";

export class DefaultEvidenceSynthesizer
implements EvidenceSynthesizer {

  constructor(

  private readonly ranker =
    new DefaultEvidenceRanker()

) {}


  async synthesize(

    evidence: EvidenceSet

  ): Promise<EvidenceSet> {

    const conflicts =

      detectConflicts(

        evidence.evidence

      );

    const resolution =

      resolveConflicts(

        evidence.evidence,

        conflicts

      );

    const verification =

      verifyEvidence(

        resolution.resolved

      );

    const deduplicated =

      deduplicateEvidence(

        verification.valid

      );

    const filtered =

filterEvidence(

  deduplicated,

  this.ranker["config"]

);
    const ranked =

      this.ranker.rankAll(

        filtered

      );

    const sorted =

      sortEvidence(

        ranked

      );

    return {

      evidence: sorted,

      comparison:
        evidence.comparison

    };

  }

}