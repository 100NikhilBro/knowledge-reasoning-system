import type {

  TraversalCache

} from "../types/traversal-cache.js";

export function clearTraversalCache(

  cache: TraversalCache

): void {

  cache.entries.clear();

}