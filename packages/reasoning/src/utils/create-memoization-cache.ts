import type {

  MemoizationCache

} from "../types/memoization-cache.js";

export function createMemoizationCache(): MemoizationCache {

  return {

    entries: new Map()

  };

}