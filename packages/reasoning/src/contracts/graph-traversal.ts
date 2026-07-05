import type {
  EvidenceSet,
  KnowledgeEntity
} from "@knowledge/shared";

import {
  GraphTraversalService
} from "@knowledge/graph";

export interface GraphTraversal {

  traverse(

    graph: GraphTraversalService,

    evidence: EvidenceSet,

    depth: number

  ): Promise<KnowledgeEntity[]>;

}