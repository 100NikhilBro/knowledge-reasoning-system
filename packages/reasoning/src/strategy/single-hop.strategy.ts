import type {
  EvidenceSet,
  ReasoningPlan
} from "@knowledge/shared";

import type {
  ReasoningStrategy
} from "./reasoning-strategy.js";

import { GraphTraversalService } from "@knowledge/graph";

export class SingleHopStrategy
implements ReasoningStrategy {

  async execute(

  _graph: GraphTraversalService,

  _plan: ReasoningPlan,

  evidence: EvidenceSet

): Promise<EvidenceSet> {

  return evidence;

}

}