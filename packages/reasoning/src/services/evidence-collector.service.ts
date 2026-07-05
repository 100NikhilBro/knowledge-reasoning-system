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

    const evidence: Evidence[] =

    retrieved.map((result:RetrievalResult ) => ({

        entity: result.entity,

        score: result.score,

        source: result.source

      }));

    return {

      evidence

    };

  }

}