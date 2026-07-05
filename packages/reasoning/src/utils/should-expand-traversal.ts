import type {

  TraversalPlan

} from "../types/traversal-plan.js";

export function shouldExpandTraversal(

  plan: TraversalPlan

): boolean {

  return (

    plan.strategy === "bfs" ||

    plan.depth.depth >= 4

  );

}