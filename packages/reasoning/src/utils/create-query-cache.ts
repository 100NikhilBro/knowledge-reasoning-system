import type {

  QueryCache

} from "../types/query-cache.js";

export function createQueryCache(): QueryCache {

  return {

    entries: new Map()

  };

}