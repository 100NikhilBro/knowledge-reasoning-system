import type {
  ReasoningRequest,
  ReasoningPlan,
  ReasoningStrategy
} from "@knowledge/shared";

import type {
  ReasoningPlanner
} from "../contracts/reasoning-planner.js";



export class DefaultReasoningPlanner
implements ReasoningPlanner {

  async plan(

    request: ReasoningRequest

  ): Promise<ReasoningPlan> {

    const query =
      request.query.toLowerCase();

    let strategy: ReasoningStrategy =
      "single-hop";

    if (query.includes("compare")) {

      strategy = "comparison";

    }

    else if (query.includes("why")) {

      strategy = "explanation";

    }

    else if (
      query.includes(" and ") ||
      query.includes("both")
    ) {

      strategy = "multi-hop";

    }

    return {

  strategy,

  maxDepth:

    strategy === "multi-hop"

      ? 3

      : 1

};

  }

}