import type {

  QueryCache

} from "../types/query-cache.js";

export function getCachedQuery(

  cache: QueryCache,

  key: string

): unknown {

  return cache.entries.get(

    key

  );

}