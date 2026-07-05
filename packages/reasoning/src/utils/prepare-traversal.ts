import type {

  TraversalPlan

} from "../types/traversal-plan.js";

import {

  buildTraversalPlan

} from "./build-traversal-plan.js";

import {

  shouldExpandTraversal

} from "./should-expand-traversal.js";

export function prepareTraversal(

  query: string

) {

  const plan =

    buildTraversalPlan(

      query

    );

  return {

    plan,

    expand:

      shouldExpandTraversal(

        plan

      )

  };

}