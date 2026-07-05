import type {

  TraversalCache

} from "../types/traversal-cache.js";

export function cacheTraversal(

  cache: TraversalCache,

  node: string,

  path: string[]

): void {

  cache.entries.set(

    node,

    path

  );

}