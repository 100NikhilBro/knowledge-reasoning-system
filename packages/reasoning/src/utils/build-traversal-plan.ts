import {

  selectTraversalStrategy

} from "./select-traversal-strategy.js";

import {

  selectTraversalDepth

} from "./select-traversal-depth.js";

import type {

  TraversalPlan

} from "../types/traversal-plan.js";

export function buildTraversalPlan(

  query: string

): TraversalPlan {

  return {

    strategy:

      selectTraversalStrategy(

        query

      ),

    depth:

      selectTraversalDepth(

        query

      )

  };

}