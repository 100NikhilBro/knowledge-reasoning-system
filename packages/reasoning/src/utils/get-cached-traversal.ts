import type {

  TraversalCache

} from "../types/traversal-cache.js";

export function getCachedTraversal(

  cache: TraversalCache,

  node: string

): string[] | undefined {

  return cache.entries.get(

    node

  );

}