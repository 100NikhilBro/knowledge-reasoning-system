import type {

  QueryCache

} from "../types/query-cache.js";

export function hasCachedQuery(

  cache: QueryCache,

  key: string

): boolean {

  return cache.entries.has(

    key

  );

}