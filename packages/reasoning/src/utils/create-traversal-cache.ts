import type {

  TraversalCache

} from "../types/traversal-cache.js";

export function createTraversalCache(): TraversalCache {

  return {

    entries: new Map()

  };

}