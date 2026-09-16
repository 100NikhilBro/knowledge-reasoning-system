import type {
  ReasoningRequest,
  ReasoningPlan
} from "@knowledge/shared";

import type {
  ReasoningPlanner
} from "../contracts/reasoning-planner.js";

import {
  understandQuery
} from "../utils/query-understanding.js";

/**
 * Plans reasoning strategy from canonical query understanding (P2).
 * Preserves existing single-hop / multi-hop / comparison / explanation
 * strategies — intent metadata is additive.
 */
export class DefaultReasoningPlanner
implements ReasoningPlanner {

  async plan(

    request: ReasoningRequest

  ): Promise<ReasoningPlan> {

    const understanding =
      understandQuery(request.query);

    const plan: ReasoningPlan = {

      strategy: understanding.strategy,

      traversal: understanding.traversal,

      maxDepth: understanding.maxDepth,

      intent: understanding.intent,

      rewrittenRepresentation:
        understanding.rewrittenRepresentation

    };

    if (understanding.focusRelationships) {
      plan.focusRelationships =
        understanding.focusRelationships;
    }

    if (understanding.requireRelationshipBetween) {
      plan.requireRelationshipBetween =
        understanding.requireRelationshipBetween;
    }

    if (understanding.bridgeEntity) {
      plan.bridgeEntity =
        understanding.bridgeEntity;
    }

    if (understanding.requireTypedEdge) {
      plan.requireTypedEdge =
        understanding.requireTypedEdge;
    }

    return plan;

  }

}
