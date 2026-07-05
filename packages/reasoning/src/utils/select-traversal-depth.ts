import type {

  TraversalDepth

} from "../types/traversal-depth.js";

export function selectTraversalDepth(

  query: string

): TraversalDepth {

  const normalized =

    query.toLowerCase();

  if (

    normalized.includes("compare")

  ) {

    return {

      depth: 1

    };

  }

  if (

    normalized.includes("relationship")

  ) {

    return {

      depth: 5

    };

  }

  if (

    normalized.includes("why")

  ) {

    return {

      depth: 4

    };

  }

  return {

    depth: 2

  };

}