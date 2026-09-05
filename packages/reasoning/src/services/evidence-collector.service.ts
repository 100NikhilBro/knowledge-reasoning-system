import type {
  Evidence,
  EvidenceSet,
  ReasoningRequest
} from "@knowledge/shared";


import { RetrievalService }
from "@knowledge/retriever";

import type { RetrievalResult }
from "@knowledge/shared";

import type {
  EvidenceCollector
} from "../contracts/evidence-collector.js";

import {
  filterCompatibleEvidence
} from "../utils/query-evidence-compatibility.js";

export class DefaultEvidenceCollector
implements EvidenceCollector {

  constructor(

    private readonly retrieval =
      new RetrievalService()

  ) {}

  async collect(

    request: ReasoningRequest

  ): Promise<EvidenceSet> {

    const retrieved =

      await this.retrieval.retrieve({

        query: request.query,

        topK: request.topK

      });

    const mapped: Evidence[] =

      retrieved.map((result: RetrievalResult) => ({

        entity: result.entity,

        score: result.score,

        source: result.source,

        ...(result.metadata
          ? { metadata: result.metadata }
          : {})

      }));

    /*
     * Seed-level compatibility before graph expansion.
     * Wrong-topic hybrid hits must not enter reasoning as seeds.
     */
    const evidence =
      filterCompatibleEvidence(
        request.query,
        mapped
      );

    return {

      evidence

    };

  }

}
