import type { TraversalStrategy } from "../types/traversal-strategy.js";

export function selectTraversalStrategy(

  query: string

): TraversalStrategy {

  const normalized =

    query.toLowerCase();

  if (

    normalized.includes("compare")

  ) {

    return "bfs";

  }

  if (

    normalized.includes("relationship")

  ) {

    return "bfs";

  }

  return "dfs";

}