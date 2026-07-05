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

import { scoreEvidence } from "../utils/score-evidence.js";

export class DefaultEvidenceSynthesizer

implements EvidenceSynthesizer {

  async synthesize(

    evidence: EvidenceSet

  ): Promise<EvidenceSet> {

    const deduplicated =

      deduplicateEvidence(

        evidence.evidence

      );

    const filtered =

      filterEvidence(

        deduplicated

      );

      const rescored = filtered.map(

  evidence => ({

    ...evidence,

    score: scoreEvidence(

      evidence

    )

  })

);

    const sorted =
sortEvidence(rescored);


    return {

      evidence: sorted

    };

  }

}