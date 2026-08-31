import type {
  ReasoningRequest,
  ReasoningPlan,
  ReasoningStrategy
} from "@knowledge/shared";

import type {
  ReasoningPlanner
} from "../contracts/reasoning-planner.js";

import {
  detectFocusRelationships
} from "../utils/detect-focus-relationships.js";

import {
  detectRelationshipBetweenQuery
} from "../utils/detect-relationship-between-query.js";

export class DefaultReasoningPlanner
implements ReasoningPlanner {

  async plan(

    request: ReasoningRequest

  ): Promise<ReasoningPlan> {

    const query =
      request.query.toLowerCase();

    const relationshipBetween =
      detectRelationshipBetweenQuery(
        request.query
      );

    const focusRelationships =
      detectFocusRelationships(
        request.query
      );

    let strategy: ReasoningStrategy =
      "single-hop";

    /*
     * Relationship-between queries must NOT fall through to multi-hop via
     * the generic " and " heuristic — that expands unrelated neighbors.
     */
    if (relationshipBetween) {

      strategy = "single-hop";

    }

    else if (query.includes("compare")) {

      strategy = "comparison";

    }

    else if (query.includes("why")) {

      strategy = "explanation";

    }

    /*
     * Compound questions that already name focused relationship types must
     * stay on single-hop so focusRelationships is applied. The generic
     * " and " / "both" heuristic otherwise selects multi-hop, which ignores
     * focus and BFS-dumps neighbors (breaking RESULTS_IN / PROPOSED_BY etc.).
     */
    else if (
      (
        query.includes(" and ") ||
        query.includes("both")
      ) &&
      !(
        focusRelationships &&
        focusRelationships.length > 0
      )
    ) {

      strategy = "multi-hop";

    }

    const plan: ReasoningPlan = {

      strategy,

      traversal:

        strategy === "multi-hop"

          ? "bfs"

          : "dfs",

      maxDepth:

        strategy === "multi-hop"

          ? 3

          : 1

    };

    if (focusRelationships) {

      plan.focusRelationships =
        focusRelationships;

    }

    if (relationshipBetween) {

      plan.requireRelationshipBetween =
        relationshipBetween;

    }

    return plan;

  }

}
