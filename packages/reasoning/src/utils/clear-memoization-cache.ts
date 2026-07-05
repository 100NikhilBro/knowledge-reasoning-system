import type {

  MemoizationCache

} from "../types/memoization-cache.js";

export function clearMemoizationCache(

  cache: MemoizationCache

): void {

  cache.entries.clear();

}