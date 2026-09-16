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

import {
  understandQuery
} from "../utils/query-understanding.js";

export class DefaultEvidenceCollector
implements EvidenceCollector {

  constructor(

    private readonly retrieval =
      new RetrievalService()

  ) {}

  async collect(

    request: ReasoningRequest

  ): Promise<EvidenceSet> {

    const understanding =
      understandQuery(request.query);

    const retrieved =

      await this.retrieval.retrieve({

        query: request.query,

        topK: request.topK,

        intent: understanding.intent,

        entities: understanding.entities,

        relationshipRequested:
          understanding.relationshipRequested,

        claims: understanding.claims.map(claim => ({
          predicate: claim.predicate,
          ...(claim.subject
            ? { subject: claim.subject }
            : {}),
          ...(claim.object
            ? { object: claim.object }
            : {})
        })),

        rewrittenRepresentation:
          understanding.rewrittenRepresentation

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
