import type {
  ReasoningRequest,
  ReasoningPlan,
  ReasoningStrategy
} from "@knowledge/shared";

import type {
  ReasoningPlanner
} from "../contracts/reasoning-planner.js";

import {
  detectFocusRelationships,
  detectMultiHopPathQuery
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

    const pathQuery =
      detectMultiHopPathQuery(
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

    /*
     * Path / chain questions need real multi-hop traversal so edges like
     * INTRODUCES → ADDRESSES survive as a connected path.
     */
    else if (pathQuery) {

      strategy = "multi-hop";

    }

    else if (query.includes("why")) {

      strategy = "explanation";

    }

    /*
     * Compound questions that already name focused relationship types must
     * stay on single-hop so focusRelationships is applied (with multi-pass
     * focused expansion). The generic " and " / "both" heuristic otherwise
     * selects multi-hop, which ignores focus and dumps neighbors.
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

    /*
     * HOW without an explicit path cue but with relationship focuses stays
     * on single-hop (focused expansion). HOW without focuses uses multi-hop
     * so connected evidence can still be gathered.
     */
    else if (
      query.includes("how") &&
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

          ? (pathQuery ? 2 : 3)

          : 1

    };

    /*
     * Explanation/how/compound still benefit from relationship focuses when
     * detected — SingleHopStrategy applies them; MultiHop ignores focuses
     * but keeps real edge provenance from traversal.
     */
    if (
      focusRelationships &&
      strategy !== "multi-hop"
    ) {

      plan.focusRelationships =
        focusRelationships;

    }

    if (
      focusRelationships &&
      strategy === "multi-hop" &&
      !pathQuery
    ) {
      /*
       * Non-path multi-hop with focuses: keep focuses unset so MultiHop
       * can traverse freely; path queries similarly leave focuses unset.
       */
    }

    if (relationshipBetween) {

      plan.requireRelationshipBetween =
        relationshipBetween;

    }

    return plan;

  }

}
