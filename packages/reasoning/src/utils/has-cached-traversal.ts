import type {

  TraversalCache

} from "../types/traversal-cache.js";

export function hasCachedTraversal(

  cache: TraversalCache,

  node: string

): boolean {

  return cache.entries.has(

    node

  );

}