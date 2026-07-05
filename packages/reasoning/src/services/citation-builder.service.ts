import type {
  Citation,
  EvidenceSet
} from "@knowledge/shared";

import type {
  CitationBuilder
} from "../contracts/citation-builder.js";

export class DefaultCitationBuilder
implements CitationBuilder {

  async build(

    evidenceSet: EvidenceSet

  ): Promise<Citation[]> {

    return evidenceSet.evidence.map(

      item => ({

        source: item.entity.source,

        entityId: item.entity.id

      })

    );

  }

}