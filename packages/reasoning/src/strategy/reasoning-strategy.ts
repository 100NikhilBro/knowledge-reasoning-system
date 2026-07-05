import type {
  EvidenceSet,
  ReasoningPlan
} from "@knowledge/shared";

import {
  GraphTraversalService
} from "@knowledge/graph";

export interface ReasoningStrategy {

  execute(

    graph: GraphTraversalService,

    plan: ReasoningPlan,

    evidence: EvidenceSet

  ): Promise<EvidenceSet>;

}